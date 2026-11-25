import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware.js';
import { Database } from '../db/database.js';

export const auditLogRouter = Router();

// GET /api/audit-logs
auditLogRouter.get('/', requireAuth(['admin', 'manager']), (req: AuthenticatedRequest, res: Response): void => {
  const { action, entityType, search, adminId, datePreset, startDate, endDate } = req.query;
  let logs = Database.getAuditLogs();

  // Filter by team member / admin
  if (adminId && typeof adminId === 'string' && adminId !== 'ALL') {
    logs = logs.filter((l) => l.adminId === adminId || l.adminUsername.toLowerCase() === adminId.toLowerCase());
  }

  // Filter by date preset
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const yesterdayStart = todayStart - 86400000;
  const yesterdayEnd = todayStart - 1;

  if (datePreset === 'today') {
    logs = logs.filter((l) => new Date(l.createdAt).getTime() >= todayStart);
  } else if (datePreset === 'yesterday') {
    logs = logs.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= yesterdayStart && t <= yesterdayEnd;
    });
  } else if (datePreset === '7days') {
    logs = logs.filter((l) => new Date(l.createdAt).getTime() >= now - 7 * 86400000);
  } else if (datePreset === '30days') {
    logs = logs.filter((l) => new Date(l.createdAt).getTime() >= now - 30 * 86400000);
  } else if (startDate && typeof startDate === 'string') {
    const sTime = new Date(startDate).getTime();
    const eTime = endDate && typeof endDate === 'string' ? new Date(endDate).getTime() : now;
    logs = logs.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= sTime && t <= eTime;
    });
  }

  if (action && typeof action === 'string' && action !== 'ALL') {
    logs = logs.filter((l) => l.action === action);
  }
  if (entityType && typeof entityType === 'string' && entityType !== 'ALL') {
    logs = logs.filter((l) => l.entityType === entityType);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    logs = logs.filter(
      (l) =>
        l.details.toLowerCase().includes(q) ||
        l.adminUsername.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q)
    );
  }

  res.json({ success: true, logs });
});
