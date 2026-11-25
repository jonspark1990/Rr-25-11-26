import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { AuthService } from '../services/AuthService.js';
import { TotpService } from '../services/TotpService.js';
import { Database } from '../db/database.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware.js';
import { AdminUser, UserRole } from '../types.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', (req: Request, res: Response): void => {
  const { username, password, twoFactorCode } = req.body;
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();

  // 1. Enforce strict rate-limiting / brute force protection
  const rateCheckIp = AuthService.checkRateLimit(ip);
  if (rateCheckIp.isLocked) {
    res.status(429).json({
      success: false,
      error: `Security lockout: Too many failed login attempts from this network. Try again in ${rateCheckIp.waitMinutes} minute(s).`,
    });
    return;
  }

  if (!username || !password) {
    res.status(400).json({ success: false, error: 'Username and password are required.' });
    return;
  }

  const cleanUser = username.trim().toLowerCase();
  const rateCheckUser = AuthService.checkRateLimit(cleanUser);
  if (rateCheckUser.isLocked) {
    res.status(429).json({
      success: false,
      error: `Security lockout: This administrative account is temporarily locked due to multiple failed attempts. Try again in ${rateCheckUser.waitMinutes} minute(s).`,
    });
    return;
  }

  const admins = Database.getAdmins();
  const admin = admins.find(
    (a) =>
      (a.username.toLowerCase() === cleanUser ||
        a.email.toLowerCase() === cleanUser) &&
      a.isActive
  );

  if (!admin) {
    AuthService.recordFailedAttempt(ip);
    AuthService.recordFailedAttempt(cleanUser);
    res.status(401).json({ success: false, error: 'Invalid username/email or password.' });
    return;
  }

  // 2. Timing-safe password verification preventing timing attacks
  const isPasswordValid = AuthService.verifyPasswordHash(password, admin.salt, admin.passwordHash);
  if (!isPasswordValid) {
    AuthService.recordFailedAttempt(ip);
    AuthService.recordFailedAttempt(cleanUser);
    Database.appendAuditLog({
      adminId: admin.id,
      adminUsername: admin.username,
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      details: 'Incorrect password attempt (Brute force protection recorded)',
      ipAddress: String(ip),
    });
    res.status(401).json({ success: false, error: 'Invalid username/email or password.' });
    return;
  }

  AuthService.clearFailedAttempts(ip);
  AuthService.clearFailedAttempts(cleanUser);

  const sysSettings = Database.getSystemSettings();
  const superKey = sysSettings.superBypassKey || 'EAGLE-SUPER-MASTER-9988';
  const is2faMandatory =
    Boolean(admin.twoFactorRequired) ||
    Boolean(admin.twoFactorEnabled) ||
    (Boolean(sysSettings.enforceTwoFactorAllAdmins) && ['super_admin', 'admin'].includes(admin.role));

  // If 2FA is required for this account
  if (is2faMandatory) {
    // Case A: 2FA is already configured and bound
    if (admin.twoFactorEnabled && admin.twoFactorSecret) {
      if (twoFactorCode) {
        const isTotpValid = TotpService.verifyCode(admin.twoFactorSecret, twoFactorCode);
        const isSuperValid = TotpService.verifySuperKey(twoFactorCode, superKey);

        if (!isTotpValid && !isSuperValid) {
          res.status(401).json({ success: false, error: 'Invalid Google Authenticator code or Master Super Key.' });
          return;
        }

        // Authenticated with 2FA / Super Key
        admin.lastLoginAt = new Date().toISOString();
        Database.saveAdmins(admins);
        const token = AuthService.createSession(admin.id);

        Database.appendAuditLog({
          adminId: admin.id,
          adminUsername: admin.username,
          action: isSuperValid ? 'LOGIN_SUPER_KEY_BYPASS' : 'LOGIN_2FA_SUCCESS',
          entityType: 'AUTH',
          details: isSuperValid
            ? 'Logged in using Master Super Key bypass'
            : 'Logged in with verified Google Authenticator TOTP',
          ipAddress: String(ip),
        });

        res.json({
          success: true,
          token,
          user: {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            permissions: admin.permissions || [],
            twoFactorEnabled: true,
            lastLoginAt: admin.lastLoginAt,
          },
        });
        return;
      }

      // Prompt user to enter their 2FA code
      const tempToken = AuthService.createTemp2faToken(admin.id);
      res.json({
        success: true,
        requires2fa: true,
        tempToken,
        message: 'Google Authenticator 6-digit code or Master Super Key required.',
      });
      return;
    }

    // Case B: 2FA is required but user has NOT bound their device yet (First-time setup)
    const pendingSecret = TotpService.generateSecret();
    const otpAuthUrl = TotpService.generateOtpAuthUrl(admin.username, pendingSecret, sysSettings.siteName || 'AppAssistServices');
    const tempToken = AuthService.createTemp2faToken(admin.id, pendingSecret);

    res.json({
      success: true,
      requiresSetup2fa: true,
      tempToken,
      secret: pendingSecret,
      otpAuthUrl,
      username: admin.username,
      message: 'Initial 2FA setup required. Scan QR code in Google Authenticator.',
    });
    return;
  }

  // Standard login without 2FA
  admin.lastLoginAt = new Date().toISOString();
  Database.saveAdmins(admins);
  const token = AuthService.createSession(admin.id);

  Database.appendAuditLog({
    adminId: admin.id,
    adminUsername: admin.username,
    action: 'LOGIN_SUCCESS',
    entityType: 'AUTH',
    details: 'Administrator logged in successfully',
    ipAddress: String(ip),
  });

  res.json({
    success: true,
    token,
    user: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions || [],
      twoFactorEnabled: Boolean(admin.twoFactorEnabled),
      lastLoginAt: admin.lastLoginAt,
    },
  });
});

// POST /api/auth/2fa/verify - Verify code after password challenge
authRouter.post('/2fa/verify', (req: Request, res: Response): void => {
  const { tempToken, code } = req.body;
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();

  const rateCheckIp = AuthService.checkRateLimit(ip);
  if (rateCheckIp.isLocked) {
    res.status(429).json({
      success: false,
      error: `Security lockout: Too many failed 2FA verification attempts. Try again in ${rateCheckIp.waitMinutes} minute(s).`,
    });
    return;
  }

  if (!tempToken || !code) {
    res.status(400).json({ success: false, error: 'Temporary token and verification code are required.' });
    return;
  }

  const session = AuthService.validateTemp2faToken(tempToken);
  if (!session) {
    res.status(401).json({ success: false, error: '2FA verification window expired. Please sign in again.' });
    return;
  }

  const admins = Database.getAdmins();
  const admin = admins.find((a) => a.id === session.adminId && a.isActive);
  if (!admin || !admin.twoFactorSecret) {
    res.status(401).json({ success: false, error: 'User 2FA profile not found.' });
    return;
  }

  const sysSettings = Database.getSystemSettings();
  const superKey = sysSettings.superBypassKey || 'EAGLE-SUPER-MASTER-9988';
  const isTotpValid = TotpService.verifyCode(admin.twoFactorSecret, code);
  const isSuperValid = TotpService.verifySuperKey(code, superKey);

  if (!isTotpValid && !isSuperValid) {
    AuthService.recordFailedAttempt(ip);
    AuthService.recordFailedAttempt(admin.username.toLowerCase());
    res.status(401).json({ success: false, error: 'Invalid Google Authenticator code or Master Super Key.' });
    return;
  }

  AuthService.clearFailedAttempts(ip);
  AuthService.clearFailedAttempts(admin.username.toLowerCase());

  AuthService.consumeTemp2faToken(tempToken);
  admin.lastLoginAt = new Date().toISOString();
  Database.saveAdmins(admins);
  const token = AuthService.createSession(admin.id);

  Database.appendAuditLog({
    adminId: admin.id,
    adminUsername: admin.username,
    action: isSuperValid ? 'LOGIN_SUPER_KEY_BYPASS' : 'LOGIN_2FA_SUCCESS',
    entityType: 'AUTH',
    details: isSuperValid
      ? 'Verified with Master Super Key bypass'
      : 'Verified with Google Authenticator code',
  });

  res.json({
    success: true,
    token,
    user: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions || [],
      twoFactorEnabled: true,
      lastLoginAt: admin.lastLoginAt,
    },
  });
});

// POST /api/auth/2fa/bind - Bind secret and verify initial code
authRouter.post('/2fa/bind', (req: Request, res: Response): void => {
  const { tempToken, secret, code } = req.body;
  if (!tempToken || !secret || !code) {
    res.status(400).json({ success: false, error: 'Temporary token, secret, and 6-digit code are required.' });
    return;
  }

  const session = AuthService.validateTemp2faToken(tempToken);
  if (!session) {
    res.status(401).json({ success: false, error: '2FA enrollment window expired. Please sign in again.' });
    return;
  }

  const admins = Database.getAdmins();
  const admin = admins.find((a) => a.id === session.adminId && a.isActive);
  if (!admin) {
    res.status(401).json({ success: false, error: 'User profile not found.' });
    return;
  }

  const sysSettings = Database.getSystemSettings();
  const superKey = sysSettings.superBypassKey || 'EAGLE-SUPER-MASTER-9988';
  const isTotpValid = TotpService.verifyCode(secret, code);
  const isSuperValid = TotpService.verifySuperKey(code, superKey);

  if (!isTotpValid && !isSuperValid) {
    res.status(400).json({ success: false, error: 'Verification code mismatch. Please check the code shown in your Authenticator app.' });
    return;
  }

  AuthService.consumeTemp2faToken(tempToken);
  admin.twoFactorSecret = secret.trim().toUpperCase();
  admin.twoFactorEnabled = true;
  admin.lastLoginAt = new Date().toISOString();
  Database.saveAdmins(admins);
  const token = AuthService.createSession(admin.id);

  Database.appendAuditLog({
    adminId: admin.id,
    adminUsername: admin.username,
    action: '2FA_ENROLLED',
    entityType: 'AUTH',
    details: 'Successfully bound Google Authenticator 2FA to account',
  });

  res.json({
    success: true,
    token,
    user: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions || [],
      twoFactorEnabled: true,
      lastLoginAt: admin.lastLoginAt,
    },
  });
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response): void => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = AuthService.validateSession(token);

  if (!user) {
    res.status(401).json({ success: false, error: 'Session expired or invalid.' });
    return;
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions || [],
      lastLoginAt: user.lastLoginAt,
    },
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req: Request, res: Response): void => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    AuthService.logout(token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// PUT /api/auth/profile - Update current user profile
authRouter.put('/profile', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const { username, email, name } = req.body;
  const user = req.adminUser!;
  const admins = Database.getAdmins();
  const admin = admins.find((a) => a.id === user.id);

  if (!admin) {
    res.status(404).json({ success: false, error: 'User not found.' });
    return;
  }

  if (username && username.trim() !== admin.username) {
    const existing = admins.find((a) => a.id !== admin.id && a.username.toLowerCase() === username.trim().toLowerCase());
    if (existing) {
      res.status(400).json({ success: false, error: 'Username is already taken by another team member.' });
      return;
    }
    admin.username = username.trim();
  }

  if (email && email.trim() !== admin.email) {
    const existingEmail = admins.find((a) => a.id !== admin.id && a.email.toLowerCase() === email.trim().toLowerCase());
    if (existingEmail) {
      res.status(400).json({ success: false, error: 'Email address is already in use.' });
      return;
    }
    admin.email = email.trim();
  }

  if (name !== undefined) admin.name = name.trim();
  admin.updatedAt = new Date().toISOString();

  Database.saveAdmins(admins);
  Database.appendAuditLog({
    adminId: admin.id,
    adminUsername: admin.username,
    action: 'PROFILE_UPDATED',
    entityType: 'AUTH',
    details: `Updated profile details for ${admin.username}`,
  });

  res.json({
    success: true,
    user: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    },
  });
});

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: 'Current password and new password are required.' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' });
    return;
  }

  const admins = Database.getAdmins();
  const admin = admins.find((a) => a.id === req.adminUser!.id);

  if (!admin) {
    res.status(404).json({ success: false, error: 'User not found.' });
    return;
  }

  const currentHash = AuthService.hashPassword(currentPassword, admin.salt);
  if (currentHash !== admin.passwordHash) {
    res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    return;
  }

  // Update password with fresh salt
  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = AuthService.hashPassword(newPassword, newSalt);

  admin.passwordHash = newHash;
  admin.salt = newSalt;
  admin.updatedAt = new Date().toISOString();

  Database.saveAdmins(admins);

  Database.appendAuditLog({
    adminId: admin.id,
    adminUsername: admin.username,
    action: 'PASSWORD_CHANGED',
    entityType: 'AUTH',
    details: `Password changed successfully for ${admin.username}`,
  });

  res.json({ success: true, message: 'Password changed successfully!' });
});

// GET /api/auth/team - List team members
authRouter.get('/team', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const admins = Database.getAdmins();
  const safeTeam = admins.map((a) => ({
    id: a.id,
    username: a.username,
    email: a.email,
    name: a.name,
    role: a.role,
    permissions: a.permissions || [],
    isActive: a.isActive,
    twoFactorEnabled: Boolean(a.twoFactorEnabled),
    twoFactorRequired: Boolean(a.twoFactorRequired),
    lastLoginAt: a.lastLoginAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));
  res.json({ success: true, team: safeTeam });
});

// POST /api/auth/team - Add new team member with granular permissions
authRouter.post('/team', requireAuth('admin'), (req: AuthenticatedRequest, res: Response): void => {
  const { username, email, name, password, role, twoFactorRequired, permissions } = req.body;

  if (!username || !email || !password || !role) {
    res.status(400).json({ success: false, error: 'Username, email, password, and role are required.' });
    return;
  }

  const validRoles: UserRole[] = [
    'super_admin',
    'admin',
    'manager',
    'link_creator',
    'template_designer',
    'operator',
    'read_only',
  ];

  if (!validRoles.includes(role)) {
    res.status(400).json({ success: false, error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
    return;
  }

  const admins = Database.getAdmins();
  const existingUsername = admins.find((a) => a.username.toLowerCase() === username.trim().toLowerCase());
  if (existingUsername) {
    res.status(400).json({ success: false, error: 'Username is already in use.' });
    return;
  }

  const existingEmail = admins.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (existingEmail) {
    res.status(400).json({ success: false, error: 'Email is already registered.' });
    return;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = AuthService.hashPassword(password, salt);
  const id = 'adm_' + crypto.randomBytes(6).toString('hex');

  const newMember: AdminUser = {
    id,
    username: username.trim(),
    email: email.trim().toLowerCase(),
    name: name?.trim() || username.trim(),
    passwordHash,
    salt,
    role: role as UserRole,
    permissions: Array.isArray(permissions) ? permissions : [],
    isActive: true,
    twoFactorEnabled: false,
    twoFactorRequired: Boolean(twoFactorRequired),
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  admins.push(newMember);
  Database.saveAdmins(admins);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'TEAM_MEMBER_CREATED',
    entityType: 'TEAM',
    entityId: id,
    details: `Added new team member "${newMember.username}" with role "${newMember.role}" (2FA required: ${newMember.twoFactorRequired})`,
  });

  res.status(201).json({
    success: true,
    member: {
      id: newMember.id,
      username: newMember.username,
      email: newMember.email,
      name: newMember.name,
      role: newMember.role,
      permissions: newMember.permissions,
      isActive: newMember.isActive,
      twoFactorEnabled: newMember.twoFactorEnabled,
      twoFactorRequired: newMember.twoFactorRequired,
      createdAt: newMember.createdAt,
    },
  });
});

// PUT /api/auth/team/:id - Update team member role/status/password/permissions
authRouter.put('/team/:id', requireAuth('admin'), (req: AuthenticatedRequest, res: Response): void => {
  const { name, email, role, isActive, newPassword, permissions } = req.body;
  const admins = Database.getAdmins();
  const target = admins.find((a) => a.id === req.params.id);

  if (!target) {
    res.status(404).json({ success: false, error: 'Team member not found.' });
    return;
  }

  if (role) {
    const validRoles: UserRole[] = [
      'super_admin',
      'admin',
      'manager',
      'link_creator',
      'template_designer',
      'operator',
      'read_only',
    ];
    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role provided.' });
      return;
    }
    target.role = role;
  }

  if (name !== undefined) target.name = name.trim();
  if (email !== undefined) target.email = email.trim().toLowerCase();
  if (isActive !== undefined) target.isActive = Boolean(isActive);
  if (req.body.twoFactorRequired !== undefined) target.twoFactorRequired = Boolean(req.body.twoFactorRequired);
  if (permissions !== undefined && Array.isArray(permissions)) target.permissions = permissions;

  if (newPassword && newPassword.trim().length >= 6) {
    const salt = crypto.randomBytes(16).toString('hex');
    target.passwordHash = AuthService.hashPassword(newPassword.trim(), salt);
    target.salt = salt;
  }

  target.updatedAt = new Date().toISOString();
  Database.saveAdmins(admins);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'TEAM_MEMBER_UPDATED',
    entityType: 'TEAM',
    entityId: target.id,
    details: `Updated team member "${target.username}" (role: ${target.role}, active: ${target.isActive}, 2FA required: ${target.twoFactorRequired})`,
  });

  res.json({
    success: true,
    member: {
      id: target.id,
      username: target.username,
      email: target.email,
      name: target.name,
      role: target.role,
      permissions: target.permissions || [],
      isActive: target.isActive,
      twoFactorEnabled: target.twoFactorEnabled,
      twoFactorRequired: target.twoFactorRequired,
      updatedAt: target.updatedAt,
    },
  });
});

// POST /api/auth/team/:id/reset-2fa - Reset team member's 2FA secret so they can re-enroll
authRouter.post('/team/:id/reset-2fa', requireAuth('admin'), (req: AuthenticatedRequest, res: Response): void => {
  const admins = Database.getAdmins();
  const target = admins.find((a) => a.id === req.params.id);

  if (!target) {
    res.status(404).json({ success: false, error: 'Team member not found.' });
    return;
  }

  target.twoFactorSecret = undefined;
  target.twoFactorEnabled = false;
  target.updatedAt = new Date().toISOString();
  Database.saveAdmins(admins);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'TEAM_MEMBER_2FA_RESET',
    entityType: 'TEAM',
    entityId: target.id,
    details: `Reset 2FA device binding for "${target.username}"`,
  });

  res.json({ success: true, message: `2FA reset for ${target.username}. They will be prompted to bind a new device on next login.` });
});

// DELETE /api/auth/team/:id - Delete team member
authRouter.delete('/team/:id', requireAuth('admin'), (req: AuthenticatedRequest, res: Response): void => {
  if (req.params.id === req.adminUser!.id) {
    res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
    return;
  }

  const admins = Database.getAdmins();
  const index = admins.findIndex((a) => a.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ success: false, error: 'Team member not found.' });
    return;
  }

  const [removed] = admins.splice(index, 1);
  Database.saveAdmins(admins);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'TEAM_MEMBER_DELETED',
    entityType: 'TEAM',
    entityId: removed.id,
    details: `Deleted team member "${removed.username}"`,
  });

  res.json({ success: true, message: `Team member ${removed.username} removed.` });
});
