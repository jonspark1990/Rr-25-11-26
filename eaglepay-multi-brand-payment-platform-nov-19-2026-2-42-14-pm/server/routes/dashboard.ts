import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware.js';
import { Database } from '../db/database.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  const requestedMemberId = typeof req.query.teamMemberId === 'string' && req.query.teamMemberId !== 'ALL' ? req.query.teamMemberId : undefined;
  const targetMemberId = !isPrivileged ? req.adminUser!.id : requestedMemberId;

  let links = Database.getPaymentLinks();
  let auditLogs = Database.getAuditLogs();

  if (targetMemberId) {
    links = links.filter((l) => l.createdByAdminId === targetMemberId);
    auditLogs = auditLogs.filter((a) => a.adminId === targetMemberId);
  }

  const txs = Database.getTransactions();
  const gateways = Database.getGatewayAccounts();

  const totalLinks = links.length;
  let totalCollected = 0;
  let successfulPayments = 0;
  let pendingPayments = 0;
  let failedPayments = 0;
  let expiredLinks = 0;

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const yesterdayStart = todayStart - 86400000;
  const yesterdayEnd = todayStart - 1;

  let paymentsToday = 0;
  let collectedToday = 0;
  let linksCreatedToday = 0;
  let linksCreatedYesterday = 0;

  for (const l of links) {
    const createdTime = new Date(l.createdAt).getTime();
    if (createdTime >= todayStart) {
      linksCreatedToday++;
    } else if (createdTime >= yesterdayStart && createdTime <= yesterdayEnd) {
      linksCreatedYesterday++;
    }

    if (l.status === 'SUCCESS') {
      successfulPayments++;
      totalCollected += l.amount;
      if (l.paidAt && new Date(l.paidAt).getTime() >= todayStart) {
        paymentsToday++;
        collectedToday += l.amount;
      }
    } else if (l.status === 'PENDING' || l.status === 'CREATED' || l.status === 'PROCESSING') {
      pendingPayments++;
    } else if (l.status === 'FAILED') {
      failedPayments++;
    } else if (l.status === 'EXPIRED') {
      expiredLinks++;
    }
  }

  const finalizedTotal = successfulPayments + failedPayments;
  const successRate = finalizedTotal > 0 ? Math.round((successfulPayments / finalizedTotal) * 100) : 100;

  // Gateway health indicators
  const gatewayHealth = gateways.map((gw) => ({
    id: gw.id,
    name: gw.name,
    adapter: gw.adapter,
    isActive: gw.isActive,
    isSandbox: gw.isSandbox,
    lastTestedAt: gw.lastTestedAt,
    lastTestStatus: gw.lastTestStatus || 'UNKNOWN',
  }));

  // Recent transactions with customer & brand details
  const customers = Database.getCustomers();
  const brands = Database.getBrands();

  const relevantLinkIds = new Set(links.map((l) => l.id));
  const filteredTxs = targetMemberId ? txs.filter((t) => relevantLinkIds.has(t.paymentLinkId)) : txs;

  const recentTransactions = filteredTxs.slice(0, 10).map((t) => {
    const parentLink = links.find((l) => l.id === t.paymentLinkId);
    const customer = customers.find((c) => c.id === parentLink?.customerId);
    const brand = brands.find((b) => b.id === parentLink?.brandId);

    return {
      id: t.id,
      merchantOrderNo: t.merchantOrderNo,
      gatewayOrderNo: t.gatewayOrderNo,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      customerName: customer?.fullName || 'N/A',
      customerMobile: customer?.mobile || 'N/A',
      brandName: brand?.name || 'N/A',
      createdAt: t.createdAt,
    };
  });

  res.json({
    success: true,
    data: {
      totalLinks,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalCollectedFormatted: totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      successfulPayments,
      pendingPayments,
      failedPayments,
      expiredLinks,
      paymentsToday,
      collectedToday: Math.round(collectedToday * 100) / 100,
      linksCreatedToday,
      linksCreatedYesterday,
      successRate,
      gatewayHealth,
      recentTransactions,
      recentActivity: auditLogs.slice(0, 10),
      isFilteredByMember: Boolean(targetMemberId),
      targetMemberId: targetMemberId || null,
    },
  });
});
