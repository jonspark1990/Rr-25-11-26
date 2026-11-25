import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware.js';
import { Database } from '../db/database.js';
import { ExportService } from '../services/ExportService.js';

export const reportRouter = Router();

// GET /api/reports/summary
reportRouter.get('/summary', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const links = Database.getPaymentLinks();
  const brands = Database.getBrands();
  const gateways = Database.getGatewayAccounts();
  const admins = Database.getAdmins();
  const customers = Database.getCustomers();

  // Team member performance aggregation
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const yesterdayStart = todayStart - 86400000;
  const yesterdayEnd = todayStart - 1;

  const teamMemberBreakdown = admins.map((member) => {
    const memberLinks = links.filter((l) => (l as any).createdByAdminId === member.id);
    const paidLinks = memberLinks.filter((l) => l.status === 'SUCCESS');
    const totalCollected = paidLinks.reduce((sum, l) => sum + l.amount, 0);
    const conversionRate = memberLinks.length > 0 ? Math.round((paidLinks.length / memberLinks.length) * 100) : 0;

    const todayMemberLinks = memberLinks.filter((l) => new Date(l.createdAt).getTime() >= todayStart);
    const todayMemberPaid = todayMemberLinks.filter((l) => l.status === 'SUCCESS');
    const todayCollected = todayMemberPaid.reduce((sum, l) => sum + l.amount, 0);

    const yesterdayMemberLinks = memberLinks.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= yesterdayStart && t <= yesterdayEnd;
    });
    const yesterdayMemberPaid = yesterdayMemberLinks.filter((l) => l.status === 'SUCCESS');
    const yesterdayCollected = yesterdayMemberPaid.reduce((sum, l) => sum + l.amount, 0);

    const recentLinks = memberLinks.slice(0, 5).map((l) => {
      const cust = customers.find((c) => c.id === l.customerId);
      return {
        id: l.id,
        token: l.token,
        amountFormatted: l.amountFormatted,
        status: l.status,
        customerName: cust?.fullName || 'Customer',
        createdAt: l.createdAt,
      };
    });

    return {
      id: member.id,
      name: member.name || member.username,
      username: member.username,
      role: member.role,
      totalLinks: memberLinks.length,
      paidLinks: paidLinks.length,
      totalCollected: Math.round(totalCollected * 100) / 100,
      conversionRate,
      todayLinks: todayMemberLinks.length,
      todayCollected: Math.round(todayCollected * 100) / 100,
      yesterdayLinks: yesterdayMemberLinks.length,
      yesterdayCollected: Math.round(yesterdayCollected * 100) / 100,
      recentLinks,
      lastLoginAt: member.lastLoginAt,
    };
  });

  // Customer behavior & collection analytics
  const paidLinksAll = links.filter((l) => l.status === 'SUCCESS');
  const totalPaidAmount = paidLinksAll.reduce((sum, l) => sum + l.amount, 0);
  const avgTicketSize = paidLinksAll.length > 0 ? Math.round((totalPaidAmount / paidLinksAll.length) * 100) / 100 : 0;

  const repeatBorrowers = customers.filter((c) => {
    const cLinks = links.filter((l) => l.customerId === c.id);
    return cLinks.length > 1;
  }).length;

  const statusDistribution = {
    SUCCESS: paidLinksAll.length,
    PENDING: links.filter((l) => l.status === 'PENDING' || l.status === 'CREATED').length,
    EXPIRED: links.filter((l) => l.status === 'EXPIRED').length,
    FAILED: links.filter((l) => l.status === 'FAILED').length,
  };

  const customerBehavior = {
    totalCustomers: customers.length,
    repeatBorrowers,
    avgTicketSize,
    totalCollected: Math.round(totalPaidAmount * 100) / 100,
    overallConversionRate: links.length > 0 ? Math.round((paidLinksAll.length / links.length) * 100) : 0,
    statusDistribution,
  };

  // Brand-wise aggregation
  const brandBreakdown = brands.map((b) => {
    const brandLinks = links.filter((l) => l.brandId === b.id);
    const paidLinks = brandLinks.filter((l) => l.status === 'SUCCESS');
    const totalAmount = paidLinks.reduce((sum, l) => sum + l.amount, 0);

    return {
      brandId: b.id,
      brandName: b.name,
      totalLinks: brandLinks.length,
      paidCount: paidLinks.length,
      totalCollected: Math.round(totalAmount * 100) / 100,
    };
  });

  // Gateway-wise aggregation
  const gatewayBreakdown = gateways.map((g) => {
    const gwLinks = links.filter((l) => l.gatewayAccountId === g.id);
    const paidLinks = gwLinks.filter((l) => l.status === 'SUCCESS');
    const totalAmount = paidLinks.reduce((sum, l) => sum + l.amount, 0);

    return {
      gatewayId: g.id,
      gatewayName: g.name,
      adapter: g.adapter,
      totalLinks: gwLinks.length,
      paidCount: paidLinks.length,
      totalCollected: Math.round(totalAmount * 100) / 100,
    };
  });

  // Daily collection breakdown (last 7 days)
  const now = Date.now();
  const dailyBreakdown: Array<{ date: string; collected: number; count: number }> = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dEnd = dStart + 86400000;
    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const dayPaid = links.filter((l) => {
      if (l.status !== 'SUCCESS' || !l.paidAt) return false;
      const pt = new Date(l.paidAt).getTime();
      return pt >= dStart && pt < dEnd;
    });

    const daySum = dayPaid.reduce((acc, l) => acc + l.amount, 0);
    dailyBreakdown.push({
      date: dateLabel,
      collected: Math.round(daySum * 100) / 100,
      count: dayPaid.length,
    });
  }

  res.json({
    success: true,
    data: {
      teamMemberBreakdown,
      customerBehavior,
      brandBreakdown,
      gatewayBreakdown,
      dailyBreakdown,
    },
  });
});

// GET /api/reports/export/csv
reportRouter.get('/export/csv', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const { type = 'payments' } = req.query;
  const links = Database.getPaymentLinks();
  const customers = Database.getCustomers();
  const brands = Database.getBrands();

  if (type === 'payments') {
    const rows = links.map((l) => {
      const cust = customers.find((c) => c.id === l.customerId);
      const brand = brands.find((b) => b.id === l.brandId);
      return {
        token: l.token,
        orderNo: l.merchantOrderNo,
        customer: cust?.fullName || '',
        brand: brand?.name || '',
        amount: l.amountFormatted,
        currency: l.currency,
        status: l.status,
        createdAt: l.createdAt,
        paidAt: l.paidAt || '',
      };
    });

    const csv = ExportService.toCsv(rows, [
      { key: 'token', label: 'Token' },
      { key: 'orderNo', label: 'Merchant Order No' },
      { key: 'customer', label: 'Customer' },
      { key: 'brand', label: 'Brand' },
      { key: 'amount', label: 'Amount' },
      { key: 'currency', label: 'Currency' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'paidAt', label: 'Paid At' },
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payments_report.csv"');
    res.send(csv);
    return;
  }

  res.status(400).json({ success: false, error: 'Unsupported report export type.' });
});

// GET /api/reports/team-member/:id/dossier - Deep-dive audit on specific team member's activity
reportRouter.get('/team-member/:id/dossier', requireAuth('manager'), (req: AuthenticatedRequest, res: Response): void => {
  const memberId = req.params.id;
  const admin = Database.getAdmins().find((a) => a.id === memberId || a.username === memberId);

  if (!admin) {
    res.status(404).json({ success: false, error: 'Team member not found.' });
    return;
  }

  const links = Database.getPaymentLinks().filter((l) => (l as any).createdByAdminId === admin.id);
  const customers = Database.getCustomers();
  const brands = Database.getBrands();
  const auditLogs = Database.getAuditLogs().filter((a) => a.adminId === admin.id || a.adminUsername === admin.username);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const yesterdayStart = todayStart - 86400000;
  const yesterdayEnd = todayStart - 1;

  const todayLinks = links.filter((l) => new Date(l.createdAt).getTime() >= todayStart).map((l) => {
    const cust = customers.find((c) => c.id === l.customerId);
    const brand = brands.find((b) => b.id === l.brandId);
    return {
      id: l.id,
      token: l.token,
      merchantOrderNo: l.merchantOrderNo,
      amount: l.amount,
      amountFormatted: l.amountFormatted,
      status: l.status,
      customerName: cust?.fullName || 'Customer',
      customerMobile: cust?.mobile || '',
      brandName: brand?.name || 'Portal',
      createdAt: l.createdAt,
      paidAt: l.paidAt,
    };
  });

  const yesterdayLinks = links.filter((l) => {
    const t = new Date(l.createdAt).getTime();
    return t >= yesterdayStart && t <= yesterdayEnd;
  }).map((l) => {
    const cust = customers.find((c) => c.id === l.customerId);
    const brand = brands.find((b) => b.id === l.brandId);
    return {
      id: l.id,
      token: l.token,
      merchantOrderNo: l.merchantOrderNo,
      amount: l.amount,
      amountFormatted: l.amountFormatted,
      status: l.status,
      customerName: cust?.fullName || 'Customer',
      customerMobile: cust?.mobile || '',
      brandName: brand?.name || 'Portal',
      createdAt: l.createdAt,
      paidAt: l.paidAt,
    };
  });

  const totalPaid = links.filter((l) => l.status === 'SUCCESS');
  const totalCollected = totalPaid.reduce((sum, l) => sum + l.amount, 0);

  res.json({
    success: true,
    dossier: {
      member: {
        id: admin.id,
        name: admin.name || admin.username,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
        createdAt: admin.createdAt,
      },
      summary: {
        totalLinksCount: links.length,
        paidLinksCount: totalPaid.length,
        totalCollected: Math.round(totalCollected * 100) / 100,
        conversionRate: links.length > 0 ? Math.round((totalPaid.length / links.length) * 100) : 0,
        todayCount: todayLinks.length,
        yesterdayCount: yesterdayLinks.length,
      },
      todayLinks,
      yesterdayLinks,
      auditLogs: auditLogs.slice(0, 50),
    },
  });
});
