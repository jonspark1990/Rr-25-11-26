import crypto from 'node:crypto';
import { Database } from '../db/database.js';
import { AdminUser, UserRole } from '../types.js';

interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

export class AuthService {
  private static loginAttempts = new Map<string, LoginAttempt>();
  private static activeSessions = new Map<string, { adminId: string; expiresAt: number }>();
  private static temp2faSessions = new Map<string, { adminId: string; pendingSecret?: string; expiresAt: number }>();

  /**
   * Create a temporary token for 2FA validation (valid 5 minutes)
   */
  public static createTemp2faToken(adminId: string, pendingSecret?: string): string {
    const tempToken = 't2fa_' + crypto.randomBytes(24).toString('hex');
    this.temp2faSessions.set(tempToken, {
      adminId,
      pendingSecret,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return tempToken;
  }

  /**
   * Validate a temporary 2FA token
   */
  public static validateTemp2faToken(tempToken: string): { adminId: string; pendingSecret?: string } | null {
    if (!tempToken) return null;
    const session = this.temp2faSessions.get(tempToken);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.temp2faSessions.delete(tempToken);
      return null;
    }
    return { adminId: session.adminId, pendingSecret: session.pendingSecret };
  }

  /**
   * Consume and invalidate temporary 2FA token
   */
  public static consumeTemp2faToken(tempToken: string): void {
    this.temp2faSessions.delete(tempToken);
  }

  /**
   * Create an active session token for an authenticated user
   */
  public static createSession(adminId: string): string {
    const token = 'sess_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 8 * 3600 * 1000; // 8 hours session
    this.activeSessions.set(token, { adminId, expiresAt });
    return token;
  }

  /**
   * Hash password with PBKDF2 sha512
   */
  public static hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  /**
   * Rate limiting check: max 5 attempts within 10 minutes
   */
  public static checkRateLimit(ipOrUsername: string): { isLocked: boolean; waitMinutes?: number } {
    const attempt = this.loginAttempts.get(ipOrUsername);
    if (!attempt) return { isLocked: false };

    const now = Date.now();
    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      const waitMinutes = Math.ceil((attempt.lockedUntil - now) / 60000);
      return { isLocked: true, waitMinutes };
    }

    // Reset if window has passed (10 minutes)
    if (now - attempt.lastAttempt > 10 * 60 * 1000) {
      this.loginAttempts.delete(ipOrUsername);
      return { isLocked: false };
    }

    return { isLocked: false };
  }

  public static verifyPasswordHash(plainPassword: string, salt: string, expectedHash: string): boolean {
    const calculated = this.hashPassword(plainPassword, salt);
    const bufA = Buffer.from(calculated, 'hex');
    const bufB = Buffer.from(expectedHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  public static recordFailedAttempt(ipOrUsername: string): void {
    const now = Date.now();
    const attempt = this.loginAttempts.get(ipOrUsername) || { count: 0, lastAttempt: now };
    attempt.count += 1;
    attempt.lastAttempt = now;

    if (attempt.count >= 10) {
      // 10+ failed attempts: lock for 60 minutes
      attempt.lockedUntil = now + 60 * 60 * 1000;
    } else if (attempt.count >= 5) {
      // 5+ failed attempts: lock for 15 minutes
      attempt.lockedUntil = now + 15 * 60 * 1000;
    }

    this.loginAttempts.set(ipOrUsername, attempt);
  }

  public static clearFailedAttempts(ipOrUsername: string): void {
    this.loginAttempts.delete(ipOrUsername);
  }

  /**
   * Authenticate admin by username/email and password
   */
  public static authenticate(
    loginIdentifier: string,
    plainPassword: string,
    ipAddress = '127.0.0.1'
  ): { success: boolean; token?: string; user?: AdminUser; error?: string } {
    const rateCheck = this.checkRateLimit(loginIdentifier);
    if (rateCheck.isLocked) {
      return {
        success: false,
        error: `Too many failed login attempts. Account temporarily locked for ${rateCheck.waitMinutes} minutes.`,
      };
    }

    const admins = Database.getAdmins();
    const admin = admins.find(
      (a) =>
        (a.username.toLowerCase() === loginIdentifier.toLowerCase() ||
          a.email.toLowerCase() === loginIdentifier.toLowerCase()) &&
        a.isActive
    );

    if (!admin) {
      this.recordFailedAttempt(loginIdentifier);
      return { success: false, error: 'Invalid username/email or password.' };
    }

    const calculatedHash = this.hashPassword(plainPassword, admin.salt);
    if (calculatedHash !== admin.passwordHash) {
      this.recordFailedAttempt(loginIdentifier);
      Database.appendAuditLog({
        adminId: admin.id,
        adminUsername: admin.username,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        details: 'Incorrect password attempt',
        ipAddress,
      });
      return { success: false, error: 'Invalid username/email or password.' };
    }

    // Login successful
    this.clearFailedAttempts(loginIdentifier);

    // Update lastLoginAt
    admin.lastLoginAt = new Date().toISOString();
    Database.saveAdmins(admins);

    // Generate cryptographic session token
    const token = 'sess_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 8 * 3600 * 1000; // 8 hours session
    this.activeSessions.set(token, { adminId: admin.id, expiresAt });

    Database.appendAuditLog({
      adminId: admin.id,
      adminUsername: admin.username,
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      details: 'Administrator logged in successfully',
      ipAddress,
    });

    return {
      success: true,
      token,
      user: admin,
    };
  }

  /**
   * Validate session token
   */
  public static validateSession(token: string | undefined): AdminUser | null {
    if (!token) return null;
    const session = this.activeSessions.get(token);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.activeSessions.delete(token);
      return null;
    }

    const admins = Database.getAdmins();
    return admins.find((a) => a.id === session.adminId && a.isActive) || null;
  }

  /**
   * Terminate session (logout)
   */
  public static logout(token: string): void {
    const session = this.activeSessions.get(token);
    if (session) {
      const admins = Database.getAdmins();
      const admin = admins.find((a) => a.id === session.adminId);
      if (admin) {
        Database.appendAuditLog({
          adminId: admin.id,
          adminUsername: admin.username,
          action: 'LOGOUT',
          entityType: 'AUTH',
          details: 'Session ended',
        });
      }
      this.activeSessions.delete(token);
    }
  }

  /**
   * Role-based permission check
   */
  public static hasPermission(userRole: UserRole, targetRole: UserRole): boolean {
    if (userRole === 'super_admin' || userRole === 'admin') return true;
    if (userRole === targetRole) return true;
    if (targetRole === 'read_only') return true;

    if (userRole === 'manager') {
      return ['manager', 'operator', 'link_creator', 'template_designer', 'read_only'].includes(targetRole);
    }

    if (userRole === 'operator') {
      return ['operator', 'link_creator', 'template_designer', 'read_only'].includes(targetRole);
    }

    if (userRole === 'link_creator') {
      return ['link_creator', 'read_only'].includes(targetRole);
    }

    if (userRole === 'template_designer') {
      return ['template_designer', 'read_only'].includes(targetRole);
    }

    return false;
  }
}
