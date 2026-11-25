import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import { Database, DEFAULT_HOME_PAGE_CONFIG } from '../db/database.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware.js';

export const systemRouter = Router();

// GET /api/system/settings - Get global system configuration
systemRouter.get('/settings', requireAuth('admin'), (_req: AuthenticatedRequest, res: Response): void => {
  const settings = Database.getSystemSettings();
  res.json({
    success: true,
    settings,
  });
});

// PUT /api/system/settings - Update global system configuration
systemRouter.put('/settings', requireAuth('admin'), (req: AuthenticatedRequest, res: Response): void => {
  const current = Database.getSystemSettings();
  const updates = req.body || {};

  const updatedSettings = {
    ...current,
    ...updates,
    homePageConfig: updates.homePageConfig
      ? {
          ...DEFAULT_HOME_PAGE_CONFIG,
          ...(current.homePageConfig || {}),
          ...updates.homePageConfig,
        }
      : current.homePageConfig || { ...DEFAULT_HOME_PAGE_CONFIG },
    retentionAuditLogsDays: Number(updates.retentionAuditLogsDays) || current.retentionAuditLogsDays || 60,
    retentionCustomersDays: Number(updates.retentionCustomersDays) || current.retentionCustomersDays || 60,
    retentionPaymentLinksDays: Number(updates.retentionPaymentLinksDays) || current.retentionPaymentLinksDays || 90,
    defaultExpiryHours: Number(updates.defaultExpiryHours) || current.defaultExpiryHours || 72,
    reconciliationCronIntervalMinutes: Number(updates.reconciliationCronIntervalMinutes) || current.reconciliationCronIntervalMinutes || 15,
  };

  Database.saveSystemSettings(updatedSettings);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'SYSTEM_SETTINGS_UPDATED',
    entityType: 'SYSTEM',
    details: 'Global system configuration and retention policies were updated',
  });

  res.json({
    success: true,
    message: 'System settings saved successfully.',
    settings: updatedSettings,
  });
});

// GET /api/system/health
systemRouter.get('/health', (req: Request, res: Response): void => {
  const settings = Database.getSystemSettings();
  const accounts = Database.getGatewayAccounts();

  res.json({
    status: 'HEALTHY',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: 'CONNECTED',
    maintenanceMode: settings.maintenanceMode,
    configuredGateways: accounts.length,
    phpCpanelPackageReady: true,
  });
});

// GET /api/system/maintenance/stats - Get storage and retention counts
systemRouter.get('/maintenance/stats', requireAuth('admin'), (req: AuthenticatedRequest, res: Response): void => {
  const settings = Database.getSystemSettings();
  const auditDays = settings.retentionAuditLogsDays || 60;
  const linkDays = settings.retentionPaymentLinksDays || 90;
  const custDays = settings.retentionCustomersDays || 60;

  const now = Date.now();
  const auditCutoff = now - auditDays * 86400000;
  const linkCutoff = now - linkDays * 86400000;
  const custCutoff = now - custDays * 86400000;

  const auditLogs = Database.getAuditLogs();
  const webhookLogs = Database.getWebhookLogs();
  const links = Database.getPaymentLinks();
  const customers = Database.getCustomers();
  const txs = Database.getTransactions();

  const expiredAuditLogs = auditLogs.filter((a) => new Date(a.createdAt).getTime() < auditCutoff).length;
  const expiredWebhookLogs = webhookLogs.filter((w) => new Date(w.createdAt).getTime() < auditCutoff).length;
  const expiredLinks = links.filter((l) => new Date(l.createdAt).getTime() < linkCutoff).length;

  res.json({
    success: true,
    stats: {
      totalAuditLogs: auditLogs.length,
      expiredAuditLogs,
      totalWebhookLogs: webhookLogs.length,
      expiredWebhookLogs,
      totalPaymentLinks: links.length,
      expiredLinks,
      totalCustomers: customers.length,
      totalTransactions: txs.length,
      retentionAuditLogsDays: auditDays,
      retentionPaymentLinksDays: linkDays,
      retentionCustomersDays: custDays,
      autoPruneEnabled: settings.autoPruneEnabled ?? true,
      lastPrunedAt: settings.lastPrunedAt,
    },
  });
});

// POST /api/system/maintenance/prune - Trigger retention purge
systemRouter.post('/maintenance/prune', requireAuth('admin'), (req: AuthenticatedRequest, res: Response): void => {
  const result = Database.pruneExpiredData();

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'DATA_RETENTION_MANUAL_PURGE',
    entityType: 'SYSTEM',
    details: `Pruned ${result.prunedAuditLogs} audit logs, ${result.prunedWebhookLogs} webhook logs, ${result.prunedLinks} links, ${result.prunedCustomers} inactive customers`,
  });

  res.json({
    success: true,
    message: 'Data retention cleanup completed successfully.',
    result,
  });
});

// POST /api/system/security/rotate-super-key - Rotate or update Master Super Key
systemRouter.post('/security/rotate-super-key', requireAuth('super_admin'), (req: AuthenticatedRequest, res: Response): void => {
  const { newKey } = req.body;
  const settings = Database.getSystemSettings();
  const generatedKey = newKey?.trim() || `EAGLE-SUPER-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${Date.now().toString().slice(-4)}`;

  settings.superBypassKey = generatedKey;
  Database.saveSystemSettings(settings);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'SUPER_KEY_ROTATED',
    entityType: 'SYSTEM',
    details: 'Master Super Key was rotated by Super Administrator',
  });

  res.json({
    success: true,
    superBypassKey: generatedKey,
    message: 'Master Super Key updated successfully.',
  });
});

// Helper function to recursively add files from a directory to JSZip
function addDirectoryToZip(zip: JSZip, localDir: string, zipPrefix: string) {
  if (!fs.existsSync(localDir)) return;
  const items = fs.readdirSync(localDir);

  for (const item of items) {
    const fullPath = path.join(localDir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const subZip = zip.folder(item);
      if (subZip) {
        addDirectoryToZip(subZip, fullPath, path.join(zipPrefix, item));
      }
    } else {
      const content = fs.readFileSync(fullPath);
      zip.file(item, content);
    }
  }
}

// GET /api/system/download-cpanel-bundle
systemRouter.get('/download-cpanel-bundle', async (req: Request, res: Response): Promise<void> => {
  try {
    const phpDir = path.resolve(process.cwd(), 'php-cpanel');
    const zip = new JSZip();

    // 1. Pack public items directly at the root of the ZIP so extracting directly inside public_html puts index.php, install.php, .htaccess, and assets directly where cPanel expects them!
    const publicDir = path.join(phpDir, 'public');
    if (fs.existsSync(publicDir)) {
      addDirectoryToZip(zip, publicDir, '');
    }

    // 2. Pack backend directories: config, cron, database, src
    const backendDirs = ['config', 'cron', 'database', 'src'];
    for (const bDir of backendDirs) {
      const fullBDir = path.join(phpDir, bDir);
      if (fs.existsSync(fullBDir)) {
        const subFolder = zip.folder(bDir);
        if (subFolder) {
          addDirectoryToZip(subFolder, fullBDir, bDir);
        }
      }
    }

    // 3. Add install.sh and README.md if present
    const installSh = path.join(phpDir, 'install.sh');
    if (fs.existsSync(installSh)) {
      zip.file('install.sh', fs.readFileSync(installSh));
    }
    const readme = path.join(phpDir, 'README.md');
    if (fs.existsSync(readme)) {
      zip.file('README.md', fs.readFileSync(readme));
    }

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="eaglepay-cpanel-production-package.zip"');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: `Failed to create ZIP package: ${msg}` });
  }
});

// GET /api/system/download-schema-sql
systemRouter.get('/download-schema-sql', (req: Request, res: Response): void => {
  const schemaPath = path.resolve(process.cwd(), 'php-cpanel/database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', 'attachment; filename="schema.sql"');
    res.sendFile(schemaPath);
  } else {
    res.status(404).send('schema.sql not found');
  }
});

// GET /api/system/download-installer-sh
systemRouter.get('/download-installer-sh', (req: Request, res: Response): void => {
  const scriptPath = path.resolve(process.cwd(), 'php-cpanel/install.sh');
  if (fs.existsSync(scriptPath)) {
    res.setHeader('Content-Type', 'text/x-shellscript');
    res.setHeader('Content-Disposition', 'attachment; filename="install.sh"');
    res.sendFile(scriptPath);
  } else {
    res.status(404).send('install.sh not found');
  }
});
