import crypto from 'node:crypto';
import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware.js';
import { Database } from '../db/database.js';
import { PaymentOrchestrator } from '../services/PaymentOrchestrator.js';
import { ExportService } from '../services/ExportService.js';
import { Customer, PaymentLink, PaymentStatus, PaymentStatusHistory } from '../types.js';

export const paymentLinkRouter = Router();

const UNPAID_STATUSES: PaymentStatus[] = ['CREATED', 'PENDING', 'PROCESSING', 'FAILED', 'REVIEW_REQUIRED'];

function getFilteredPaymentLinks(req: AuthenticatedRequest): PaymentLink[] {
  const { status, brandId, customerId, search, createdByAdminId, datePreset, startDate, endDate, ids } = req.query;
  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  let links = Database.getPaymentLinks();

  // 1. Role-based isolation: Team members (e.g. link_creator) ONLY see links created by themselves
  if (!isPrivileged) {
    links = links.filter((l) => l.createdByAdminId === req.adminUser!.id);
  } else if (createdByAdminId && typeof createdByAdminId === 'string' && createdByAdminId !== 'ALL') {
    links = links.filter((l) => l.createdByAdminId === createdByAdminId);
  }

  // Optional explicit ID list filter (e.g., export selected rows)
  if (ids && typeof ids === 'string' && ids.trim()) {
    const idSet = new Set(ids.split(',').map((s) => s.trim()).filter(Boolean));
    if (idSet.size > 0) {
      links = links.filter((l) => idSet.has(l.id));
    }
  }

  // 2. Date presets & custom range filtering
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const yesterdayStart = todayStart - 86400000;
  const yesterdayEnd = todayStart - 1;

  if (datePreset === 'today') {
    links = links.filter((l) => new Date(l.createdAt).getTime() >= todayStart);
  } else if (datePreset === 'yesterday') {
    links = links.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= yesterdayStart && t <= yesterdayEnd;
    });
  } else if (datePreset === '7days') {
    links = links.filter((l) => new Date(l.createdAt).getTime() >= now - 7 * 86400000);
  } else if (datePreset === '30days') {
    links = links.filter((l) => new Date(l.createdAt).getTime() >= now - 30 * 86400000);
  } else if (startDate && typeof startDate === 'string') {
    const sTime = new Date(startDate).getTime();
    const eTime = endDate && typeof endDate === 'string' ? new Date(endDate).getTime() + 86399999 : now;
    if (!isNaN(sTime)) {
      links = links.filter((l) => {
        const t = new Date(l.createdAt).getTime();
        return t >= sTime && t <= eTime;
      });
    }
  }

  // 3. Status filter (supports 'UNPAID' preset or comma-separated list)
  if (status && typeof status === 'string' && status !== 'ALL') {
    if (status === 'UNPAID') {
      links = links.filter((l) => UNPAID_STATUSES.includes(l.status));
    } else if (status.includes(',')) {
      const allowed = new Set(status.split(',').map((s) => s.trim().toUpperCase()));
      links = links.filter((l) => allowed.has(l.status));
    } else {
      links = links.filter((l) => l.status === status);
    }
  }

  if (brandId && typeof brandId === 'string' && brandId !== 'ALL') {
    links = links.filter((l) => l.brandId === brandId);
  }
  if (customerId && typeof customerId === 'string') {
    links = links.filter((l) => l.customerId === customerId);
  }
  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    const customers = Database.getCustomers();
    links = links.filter((l) => {
      const cust = customers.find((c) => c.id === l.customerId);
      return (
        l.token.toLowerCase().includes(q) ||
        l.merchantOrderNo.toLowerCase().includes(q) ||
        (l.loanOrderNumber && l.loanOrderNumber.toLowerCase().includes(q)) ||
        (l.externalReference && l.externalReference.toLowerCase().includes(q)) ||
        (l.manualSubmission?.utrNumber && l.manualSubmission.utrNumber.toLowerCase().includes(q)) ||
        (cust && (cust.fullName.toLowerCase().includes(q) || (cust.mobile && cust.mobile.toLowerCase().includes(q))))
      );
    });
  }

  return links;
}

// GET /api/payment-links
paymentLinkRouter.get('/', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const links = getFilteredPaymentLinks(req);

  const customers = Database.getCustomers();
  const brands = Database.getBrands();
  const gateways = Database.getGatewayAccounts();
  const admins = Database.getAdmins();

  const enriched = links.map((l) => {
    const customer = customers.find((c) => c.id === l.customerId);
    const brand = brands.find((b) => b.id === l.brandId);
    const gateway = gateways.find((g) => g.id === l.gatewayAccountId);
    const creator = admins.find((a) => a.id === l.createdByAdminId);
    const isExpired = new Date(l.expiresAt).getTime() < Date.now();

    return {
      ...l,
      customerName: customer?.fullName || 'N/A',
      customerMobile: customer?.mobile || 'N/A',
      customerEmail: customer?.email || 'N/A',
      brandName: brand?.name || 'N/A',
      brandSlug: brand?.slug || 'pay',
      brandLogo: brand?.logoUrl,
      gatewayName: gateway?.name || 'N/A',
      gatewayAdapter: gateway?.adapter || 'eaglepay',
      createdByName: creator?.name || creator?.username || 'Administrator',
      createdByUsername: creator?.username || 'admin',
      isExpired,
      publicUrl: `/${brand?.slug || 'pay'}/pay/${l.token}`,
    };
  });

  res.json({ success: true, links: enriched });
});

// GET /api/payment-links/export/csv (Filtered CSV Export)
paymentLinkRouter.get('/export/csv', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const links = getFilteredPaymentLinks(req);
  const customers = Database.getCustomers();
  const brands = Database.getBrands();

  const rows = links.map((l) => {
    const cust = customers.find((c) => c.id === l.customerId);
    const brand = brands.find((b) => b.id === l.brandId);
    return {
      token: l.token,
      merchantOrderNo: l.merchantOrderNo,
      loanOrderNumber: l.loanOrderNumber || '',
      customer: cust?.fullName || '',
      mobile: cust?.mobile || '',
      email: cust?.email || '',
      brand: brand?.name || '',
      amount: l.amountFormatted,
      currency: l.currency,
      status: l.status,
      isEnabled: l.isEnabled ? 'Yes' : 'No',
      createdAt: l.createdAt,
      expiresAt: l.expiresAt,
      paidAt: l.paidAt || '',
    };
  });

  const csv = ExportService.toCsv(rows, [
    { key: 'token', label: 'Link Token' },
    { key: 'merchantOrderNo', label: 'Merchant Order No' },
    { key: 'loanOrderNumber', label: 'Loan Order No' },
    { key: 'customer', label: 'Customer Name' },
    { key: 'mobile', label: 'Customer Mobile' },
    { key: 'email', label: 'Customer Email' },
    { key: 'brand', label: 'Brand' },
    { key: 'amount', label: 'Amount (INR)' },
    { key: 'currency', label: 'Currency' },
    { key: 'status', label: 'Status' },
    { key: 'isEnabled', label: 'Enabled' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'expiresAt', label: 'Expires At' },
    { key: 'paidAt', label: 'Paid At' },
  ]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="payment_links_export.csv"');
  res.send(csv);
});

// GET /api/payment-links/export/json (Portable Filtered JSON Backup for Railway Migration)
paymentLinkRouter.get('/export/json', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const links = getFilteredPaymentLinks(req);
  const customers = Database.getCustomers();
  const brands = Database.getBrands();
  const gateways = Database.getGatewayAccounts();
  const settings = Database.getSystemSettings();

  const bundleLinks = links.map((l) => {
    const customer = customers.find((c) => c.id === l.customerId);
    const brand = brands.find((b) => b.id === l.brandId);
    const gateway = gateways.find((g) => g.id === l.gatewayAccountId);

    return {
      ...l,
      brandName: brand?.name || '',
      brandSlug: brand?.slug || '',
      gatewayName: gateway?.name || '',
      gatewayAdapter: gateway?.adapter || 'eaglepay',
      customer: customer
        ? {
            id: customer.id,
            fullName: customer.fullName,
            mobile: customer.mobile,
            email: customer.email,
            panNumber: customer.panNumber,
            bankAccount: customer.bankAccount,
            executiveName: customer.executiveName,
            address: customer.address,
            city: customer.city,
            state: customer.state,
            pincode: customer.pincode,
            externalReference: customer.externalReference,
            businessReference: customer.businessReference,
            notes: customer.notes,
          }
        : undefined,
    };
  });

  const payload = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: req.adminUser?.username || 'admin',
    sourceSiteName: settings.siteName || 'AppAssistServices',
    filters: {
      status: req.query.status || 'ALL',
      brandId: req.query.brandId || 'ALL',
      datePreset: req.query.datePreset || 'all',
      search: req.query.search || '',
    },
    totalLinks: bundleLinks.length,
    links: bundleLinks,
  };

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'PAYMENT_LINKS_BULK_EXPORTED',
    entityType: 'PAYMENT_LINK',
    details: `Exported ${bundleLinks.length} payment link(s) to portable JSON backup (status filter: ${String(req.query.status || 'ALL')})`,
  });

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="payment-links-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(payload, null, 2));
});

// POST /api/payment-links/import (Bulk Import Payment Links + Customers)
paymentLinkRouter.post('/import', requireAuth(['operator', 'link_creator']), (req: AuthenticatedRequest, res: Response): void => {
  const {
    links: incomingLinks,
    duplicateStrategy = 'skip',
    brandMode = 'match',
    targetBrandId,
    gatewayMode = 'match',
    targetGatewayAccountId,
    extendExpiryHours = 0,
  } = req.body || {};

  if (!Array.isArray(incomingLinks) || incomingLinks.length === 0) {
    res.status(400).json({ success: false, error: 'Please provide a valid array of payment links to import.' });
    return;
  }

  const existingLinks = Database.getPaymentLinks();
  const existingCustomers = Database.getCustomers();
  const brands = Database.getBrands();
  const gateways = Database.getGatewayAccounts();
  const admins = Database.getAdmins();
  const history = Database.getPaymentStatusHistory();

  if (brands.length === 0) {
    res.status(400).json({ success: false, error: 'At least one Brand must exist before importing payment links.' });
    return;
  }
  if (gateways.length === 0) {
    res.status(400).json({ success: false, error: 'At least one Gateway Account must exist before importing payment links.' });
    return;
  }

  const fallbackBrand =
    (targetBrandId && brands.find((b) => b.id === targetBrandId)) ||
    brands.find((b) => b.isActive) ||
    brands[0];

  const fallbackGateway =
    (targetGatewayAccountId && gateways.find((g) => g.id === targetGatewayAccountId)) ||
    gateways.find((g) => g.isActive && !g.isSandbox) ||
    gateways.find((g) => g.isActive) ||
    gateways[0];

  const adminIdSet = new Set(admins.map((a) => a.id));
  const linkByToken = new Map<string, number>();
  const linkByOrder = new Map<string, number>();
  existingLinks.forEach((l, idx) => {
    linkByToken.set(l.token.toUpperCase(), idx);
    linkByOrder.set(l.merchantOrderNo.toUpperCase(), idx);
  });

  const cleanMobile = (m?: string) => (m || '').replace(/\D/g, '').slice(-10);

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let customersCreated = 0;
  const errors: string[] = [];

  const nowIso = new Date().toISOString();
  const extendMs = Number(extendExpiryHours) > 0 ? Number(extendExpiryHours) * 3600 * 1000 : 0;

  for (let i = 0; i < incomingLinks.length; i++) {
    const raw = incomingLinks[i];
    if (!raw || typeof raw !== 'object') {
      errors.push(`Row ${i + 1}: Invalid record object.`);
      continue;
    }

    const token = String(raw.token || '').trim() || 'PAY' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const merchantOrderNo =
      String(raw.merchantOrderNo || '').trim() ||
      `ORD-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const amountNum = Number(raw.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      errors.push(`Row ${i + 1} (${token}): Invalid payable amount.`);
      continue;
    }

    // 1. Resolve or upsert Customer
    const custData = raw.customer && typeof raw.customer === 'object' ? raw.customer : {};
    const custFullName = String(custData.fullName || raw.customerName || 'Valued Customer').trim();
    const custMobileRaw = String(custData.mobile || raw.customerMobile || '').trim();
    const custEmail = String(custData.email || raw.customerEmail || '').trim();
    const normMobile = cleanMobile(custMobileRaw);

    let resolvedCustomer: Customer | undefined = existingCustomers.find(
      (c) =>
        (raw.customerId && c.id === raw.customerId) ||
        (custData.id && c.id === custData.id) ||
        (normMobile && normMobile.length >= 8 && cleanMobile(c.mobile) === normMobile)
    );

    if (!resolvedCustomer) {
      resolvedCustomer = {
        id: 'cust_' + crypto.randomBytes(6).toString('hex'),
        fullName: custFullName || 'Valued Customer',
        mobile: custMobileRaw || '0000000000',
        email: custEmail || (normMobile ? `${normMobile}@customer.portal` : ''),
        panNumber: custData.panNumber || raw.panNumber || undefined,
        bankAccount: custData.bankAccount || raw.bankAccount || undefined,
        executiveName: custData.executiveName || raw.executiveName || undefined,
        address: custData.address || undefined,
        city: custData.city || undefined,
        state: custData.state || undefined,
        pincode: custData.pincode || undefined,
        externalReference: custData.externalReference || raw.externalReference || undefined,
        businessReference: custData.businessReference || undefined,
        notes: custData.notes || undefined,
        createdByAdminId: req.adminUser!.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      existingCustomers.unshift(resolvedCustomer);
      customersCreated++;
    } else {
      // Backfill missing KYC metadata if existing customer lacks it
      if (!resolvedCustomer.panNumber && (custData.panNumber || raw.panNumber)) {
        resolvedCustomer.panNumber = custData.panNumber || raw.panNumber;
      }
      if (!resolvedCustomer.bankAccount && (custData.bankAccount || raw.bankAccount)) {
        resolvedCustomer.bankAccount = custData.bankAccount || raw.bankAccount;
      }
      if (!resolvedCustomer.executiveName && (custData.executiveName || raw.executiveName)) {
        resolvedCustomer.executiveName = custData.executiveName || raw.executiveName;
      }
      resolvedCustomer.updatedAt = nowIso;
    }

    // 2. Resolve Brand
    let resolvedBrand = fallbackBrand;
    if (brandMode !== 'override') {
      const matchedBrand = brands.find(
        (b) =>
          (raw.brandId && b.id === raw.brandId) ||
          (raw.brandSlug && b.slug.toLowerCase() === String(raw.brandSlug).toLowerCase()) ||
          (raw.brandName && b.name.toLowerCase() === String(raw.brandName).toLowerCase())
      );
      if (matchedBrand) resolvedBrand = matchedBrand;
    }

    // 3. Resolve Gateway Account
    let resolvedGateway = fallbackGateway;
    if (gatewayMode !== 'override') {
      const matchedGateway = gateways.find(
        (g) =>
          (raw.gatewayAccountId && g.id === raw.gatewayAccountId) ||
          (raw.gatewayName && g.name.toLowerCase() === String(raw.gatewayName).toLowerCase())
      );
      if (matchedGateway) resolvedGateway = matchedGateway;
    }

    // 4. Compute Expiry
    let expiresAt = raw.expiresAt && !isNaN(new Date(raw.expiresAt).getTime())
      ? new Date(raw.expiresAt).toISOString()
      : new Date(Date.now() + 72 * 3600 * 1000).toISOString();

    const statusValue: PaymentStatus = (['CREATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'EXPIRED', 'REVIEW_REQUIRED'].includes(raw.status)
      ? raw.status
      : 'CREATED') as PaymentStatus;

    if (extendMs > 0 && statusValue !== 'SUCCESS') {
      const baseTime = Math.max(Date.now(), new Date(expiresAt).getTime());
      expiresAt = new Date(baseTime + extendMs).toISOString();
    }

    const existingIdx =
      linkByToken.get(token.toUpperCase()) ?? linkByOrder.get(merchantOrderNo.toUpperCase());

    const roundedAmount = Math.round(amountNum * 100) / 100;
    const creatorId = raw.createdByAdminId && adminIdSet.has(raw.createdByAdminId)
      ? raw.createdByAdminId
      : req.adminUser!.id;

    if (existingIdx !== undefined) {
      if (duplicateStrategy !== 'overwrite') {
        skippedCount++;
        continue;
      }

      const current = existingLinks[existingIdx];
      existingLinks[existingIdx] = {
        ...current,
        customerId: resolvedCustomer.id,
        brandId: resolvedBrand.id,
        gatewayAccountId: resolvedGateway.id,
        amount: roundedAmount,
        amountFormatted: roundedAmount.toFixed(2),
        currency: raw.currency || current.currency || 'INR',
        description: raw.description ?? current.description,
        loanOrderNumber: raw.loanOrderNumber ?? current.loanOrderNumber,
        repaymentDate: raw.repaymentDate ?? current.repaymentDate,
        panNumber: raw.panNumber ?? current.panNumber,
        bankAccount: raw.bankAccount ?? current.bankAccount,
        executiveName: raw.executiveName ?? current.executiveName,
        externalReference: raw.externalReference ?? current.externalReference,
        ogTitle: raw.ogTitle ?? current.ogTitle,
        ogDescription: raw.ogDescription ?? current.ogDescription,
        ogImageUrl: raw.ogImageUrl ?? current.ogImageUrl,
        status: statusValue === 'EXPIRED' && extendMs > 0 ? 'CREATED' : statusValue,
        isEnabled: raw.isEnabled !== undefined ? Boolean(raw.isEnabled) : current.isEnabled,
        expiresAt,
        updatedAt: nowIso,
      };
      updatedCount++;
      continue;
    }

    const newLink: PaymentLink = {
      id: 'plink_' + crypto.randomBytes(6).toString('hex'),
      token,
      customerId: resolvedCustomer.id,
      brandId: resolvedBrand.id,
      gatewayAccountId: resolvedGateway.id,
      amount: roundedAmount,
      amountFormatted: roundedAmount.toFixed(2),
      currency: raw.currency || 'INR',
      description: raw.description || 'Loan Repayment',
      loanOrderNumber: raw.loanOrderNumber || merchantOrderNo,
      repaymentDate: raw.repaymentDate || undefined,
      panNumber: raw.panNumber || resolvedCustomer.panNumber || undefined,
      bankAccount: raw.bankAccount || resolvedCustomer.bankAccount || undefined,
      executiveName: raw.executiveName || resolvedCustomer.executiveName || undefined,
      externalReference: raw.externalReference || undefined,
      ogTitle: raw.ogTitle || undefined,
      ogDescription: raw.ogDescription || undefined,
      ogImageUrl: raw.ogImageUrl || undefined,
      merchantOrderNo,
      gatewayOrderNo: raw.gatewayOrderNo || undefined,
      gatewayPayUrl: raw.gatewayPayUrl || undefined,
      status: statusValue === 'EXPIRED' && extendMs > 0 ? 'CREATED' : statusValue,
      isEnabled: raw.isEnabled !== undefined ? Boolean(raw.isEnabled) : true,
      expiresAt,
      paidAt: raw.paidAt || undefined,
      viewCount: Number(raw.viewCount) || 0,
      clickCount: Number(raw.clickCount) || 0,
      createdByAdminId: creatorId,
      createdAt: raw.createdAt && !isNaN(new Date(raw.createdAt).getTime()) ? raw.createdAt : nowIso,
      updatedAt: nowIso,
    };

    existingLinks.unshift(newLink);
    linkByToken.set(newLink.token.toUpperCase(), 0);
    linkByOrder.set(newLink.merchantOrderNo.toUpperCase(), 0);

    const histEntry: PaymentStatusHistory = {
      id: 'psh_' + crypto.randomBytes(5).toString('hex'),
      paymentLinkId: newLink.id,
      previousStatus: newLink.status,
      newStatus: newLink.status,
      source: 'ADMIN_OVERRIDE',
      reason: 'Imported via Bulk Backup Migration',
      actor: req.adminUser!.username,
      createdAt: nowIso,
    };
    history.unshift(histEntry);
    importedCount++;
  }

  Database.saveCustomers(existingCustomers);
  Database.savePaymentLinks(existingLinks);
  Database.savePaymentStatusHistory(history);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'PAYMENT_LINKS_BULK_IMPORTED',
    entityType: 'PAYMENT_LINK',
    details: `Bulk imported ${importedCount} new, updated ${updatedCount}, skipped ${skippedCount} link(s); created ${customersCreated} customer(s)`,
  });

  res.json({
    success: true,
    importedCount,
    updatedCount,
    skippedCount,
    customersCreated,
    failedCount: errors.length,
    errors: errors.slice(0, 20),
  });
});

// GET /api/payment-links/:id
paymentLinkRouter.get('/:id', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const links = Database.getPaymentLinks();
  const link = links.find((l) => l.id === req.params.id || l.token === req.params.id);

  if (!link) {
    res.status(404).json({ success: false, error: 'Payment link not found.' });
    return;
  }

  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  if (!isPrivileged && link.createdByAdminId !== req.adminUser!.id) {
    res.status(403).json({ success: false, error: 'Access denied. You can only view payment links created by you.' });
    return;
  }

  const customer = Database.getCustomers().find((c) => c.id === link.customerId);
  const brand = Database.getBrands().find((b) => b.id === link.brandId);
  const gateway = Database.getGatewayAccounts().find((g) => g.id === link.gatewayAccountId);
  const history = Database.getPaymentStatusHistory().filter((h) => h.paymentLinkId === link.id);
  const transactions = Database.getTransactions().filter((t) => t.paymentLinkId === link.id);
  const creator = Database.getAdmins().find((a) => a.id === link.createdByAdminId);

  res.json({
    success: true,
    link: {
      ...link,
      customer,
      brand,
      gateway,
      gatewayAdapter: gateway?.adapter || 'eaglepay',
      history,
      transactions,
      createdByName: creator?.name || creator?.username || 'Administrator',
      createdByUsername: creator?.username || 'admin',
      publicUrl: `/${brand?.slug || 'pay'}/pay/${link.token}`,
    },
  });
});

// POST /api/payment-links
paymentLinkRouter.post('/', requireAuth(['operator', 'link_creator']), (req: AuthenticatedRequest, res: Response): void => {
  const {
    customerId,
    customerName,
    customerMobile,
    customerEmail,
    panNumber,
    bankAccount,
    executiveName,
    loanOrderNumber,
    repaymentDate,
    brandId,
    gatewayAccountId,
    amount,
    description,
    externalReference,
    expiresInHours,
    ogTitle,
    ogDescription,
    ogImageUrl,
  } = req.body;

  const result = PaymentOrchestrator.createPaymentLink({
    customerId,
    customerName,
    customerMobile,
    customerEmail,
    panNumber,
    bankAccount,
    executiveName,
    loanOrderNumber,
    repaymentDate,
    brandId,
    gatewayAccountId,
    amount: parseFloat(amount),
    description,
    externalReference,
    expiresInHours: expiresInHours ? parseInt(expiresInHours, 10) : undefined,
    adminId: req.adminUser!.id,
    ogTitle,
    ogDescription,
    ogImageUrl,
  });

  if (!result.success || !result.link) {
    res.status(400).json({ success: false, error: result.error || 'Failed to generate payment link' });
    return;
  }

  const createdLink = result.link;
  const brand = Database.getBrands().find((b) => b.id === createdLink.brandId);
  const customer = Database.getCustomers().find((c) => c.id === createdLink.customerId);
  const enrichedLink = {
    ...createdLink,
    customerName: customer?.fullName || customerName || 'Customer',
    customerMobile: customer?.mobile || customerMobile || '',
    brandName: brand?.name || 'Loan Services',
    brandSlug: brand?.slug || 'pay',
    publicUrl: `/${brand?.slug || 'pay'}/pay/${createdLink.token}`,
  };

  res.status(201).json({ success: true, link: enrichedLink });
});

// PUT /api/payment-links/:id
paymentLinkRouter.put('/:id', requireAuth(['operator', 'link_creator']), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  const {
    customerId,
    customerName,
    customerMobile,
    customerEmail,
    brandId,
    gatewayAccountId,
    merchantOrderNo,
    amount,
    description,
    loanOrderNumber,
    repaymentDate,
    panNumber,
    bankAccount,
    executiveName,
    externalReference,
    expiresAt,
    expiresInHours,
    isEnabled,
    ogTitle,
    ogDescription,
    ogImageUrl,
    ogImage,
  } = req.body || {};

  const links = Database.getPaymentLinks();
  const link = links.find((l) => l.id === id || l.token === id);

  if (!link) {
    res.status(404).json({ success: false, error: 'Payment link not found.' });
    return;
  }

  if (!isPrivileged && link.createdByAdminId !== req.adminUser!.id) {
    res.status(403).json({ success: false, error: 'Access denied. You can only edit payment links created by you.' });
    return;
  }

  const brands = Database.getBrands();
  const gateways = Database.getGatewayAccounts();
  const customers = Database.getCustomers();
  const history = Database.getPaymentStatusHistory();
  const nowIso = new Date().toISOString();
  const changeSummary: string[] = [];

  const isAlreadyPaid = link.status === 'SUCCESS';

  // 1. Validate Amount
  let nextAmount: number | undefined;
  if (amount !== undefined && amount !== null && String(amount).trim() !== '') {
    const parsedAmount = parseFloat(String(amount));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ success: false, error: 'Payable amount must be a valid positive number greater than 0.' });
      return;
    }
    const rounded = Math.round(parsedAmount * 100) / 100;
    if (rounded !== link.amount) {
      if (isAlreadyPaid) {
        res.status(400).json({ success: false, error: 'Cannot change payable amount after payment is already SUCCESS.' });
        return;
      }
      nextAmount = rounded;
    }
  }

  // 2. Validate Gateway Account Switch
  let nextGatewayId: string | undefined;
  if (gatewayAccountId !== undefined && gatewayAccountId !== link.gatewayAccountId) {
    if (isAlreadyPaid) {
      res.status(400).json({ success: false, error: 'Cannot switch payment gateway after payment is already SUCCESS.' });
      return;
    }
    const targetGateway = gateways.find((g) => g.id === gatewayAccountId && g.isActive);
    if (!targetGateway) {
      res.status(400).json({ success: false, error: 'Selected payment gateway does not exist or is inactive.' });
      return;
    }
    nextGatewayId = targetGateway.id;
  }

  // 3. Validate Brand Switch
  if (brandId !== undefined && brandId !== link.brandId) {
    const targetBrand = brands.find((b) => b.id === brandId && b.isActive);
    if (!targetBrand) {
      res.status(400).json({ success: false, error: 'Selected brand does not exist or is inactive.' });
      return;
    }
    const prevBrand = brands.find((b) => b.id === link.brandId);
    link.brandId = targetBrand.id;
    changeSummary.push(`Brand: ${prevBrand?.name || 'N/A'} -> ${targetBrand.name}`);
  }

  // 4. Validate Merchant Order No Uniqueness if edited
  if (merchantOrderNo !== undefined) {
    const cleanOrd = String(merchantOrderNo).trim();
    if (!cleanOrd) {
      res.status(400).json({ success: false, error: 'Merchant Order No cannot be empty.' });
      return;
    }
    if (cleanOrd !== link.merchantOrderNo) {
      const conflict = links.find((l) => l.id !== link.id && l.merchantOrderNo.toUpperCase() === cleanOrd.toUpperCase());
      if (conflict) {
        res.status(400).json({ success: false, error: `Merchant Order No "${cleanOrd}" is already used by link ${conflict.token}.` });
        return;
      }
      changeSummary.push(`Order No: ${link.merchantOrderNo} -> ${cleanOrd}`);
      link.merchantOrderNo = cleanOrd;
    }
  }

  // 5. Apply Amount Update (and reset stale gateway checkout session so next initiation uses the new amount)
  if (nextAmount !== undefined) {
    const prevFormatted = link.amountFormatted;
    const prevStatus = link.status;
    link.amount = nextAmount;
    link.amountFormatted = nextAmount.toFixed(2);
    link.gatewayPayUrl = null;
    link.gatewayOrderNo = null;
    link.currentGatewayMchOrderNo = undefined;
    link.manualSubmission = undefined;
    if (prevStatus === 'PENDING' || prevStatus === 'FAILED' || prevStatus === 'REVIEW_REQUIRED') {
      link.status = 'CREATED';
    }
    changeSummary.push(`Amount: ₹${prevFormatted} -> ₹${link.amountFormatted}`);
  }

  // 6. Apply Gateway Switch (reset stale session URLs/orders/manual submission cleanly so customer hits new gateway)
  if (nextGatewayId !== undefined) {
    const oldGw = gateways.find((g) => g.id === link.gatewayAccountId);
    const newGw = gateways.find((g) => g.id === nextGatewayId);
    const prevStatus = link.status;
    link.gatewayAccountId = nextGatewayId;
    link.gatewayPayUrl = null;
    link.gatewayOrderNo = null;
    link.currentGatewayMchOrderNo = undefined;
    link.manualSubmission = undefined;
    if (prevStatus === 'PENDING' || prevStatus === 'FAILED' || prevStatus === 'REVIEW_REQUIRED') {
      link.status = 'CREATED';
    }
    changeSummary.push(`Gateway: ${oldGw?.name || 'N/A'} -> ${newGw?.name || 'N/A'}`);

    history.unshift({
      id: 'psh_' + crypto.randomBytes(6).toString('hex'),
      paymentLinkId: link.id,
      previousStatus: prevStatus,
      newStatus: link.status,
      source: 'ADMIN_OVERRIDE',
      reason: `Payment gateway switched from "${oldGw?.name || 'Unknown'}" to "${newGw?.name || 'Unknown'}"`,
      actor: req.adminUser!.username,
      createdAt: nowIso,
    });
  }

  // 7. Customer Reassignment or Inline Customer Update
  let customersDirty = false;
  if (customerId && customerId !== link.customerId) {
    const targetCustomer = customers.find((c) => c.id === customerId);
    if (!targetCustomer) {
      res.status(400).json({ success: false, error: 'Selected customer does not exist.' });
      return;
    }
    link.customerId = targetCustomer.id;
    changeSummary.push(`Customer switched to ${targetCustomer.fullName}`);
  } else if (customerName !== undefined || customerMobile !== undefined || customerEmail !== undefined) {
    const currentCustomer = customers.find((c) => c.id === link.customerId);
    const cleanName = customerName !== undefined ? String(customerName).trim() : currentCustomer?.fullName || '';
    const cleanMobile =
      customerMobile !== undefined ? String(customerMobile).replace(/[^0-9+]/g, '').trim() : currentCustomer?.mobile || '';
    const cleanEmail = customerEmail !== undefined ? String(customerEmail).trim().toLowerCase() : currentCustomer?.email || '';

    if (customerName !== undefined && !cleanName) {
      res.status(400).json({ success: false, error: 'Customer name cannot be empty.' });
      return;
    }
    if (customerMobile !== undefined && cleanMobile.length < 8) {
      res.status(400).json({ success: false, error: 'Please enter a valid customer mobile number (at least 8 digits).' });
      return;
    }

    const otherLinksUsingSameCustomer = links.some((l) => l.id !== link.id && l.customerId === link.customerId);
    const infoChanged =
      !currentCustomer ||
      (customerName !== undefined && cleanName !== currentCustomer.fullName) ||
      (customerMobile !== undefined && cleanMobile !== currentCustomer.mobile) ||
      (customerEmail !== undefined && cleanEmail !== (currentCustomer.email || ''));

    if (infoChanged) {
      if (otherLinksUsingSameCustomer) {
        // Isolate edit so other historical links for the old customer stay intact
        let matched = cleanMobile ? customers.find((c) => c.mobile === cleanMobile && c.fullName.toLowerCase() === cleanName.toLowerCase()) : undefined;
        if (!matched) {
          matched = {
            id: 'cust_' + crypto.randomBytes(6).toString('hex'),
            fullName: cleanName || currentCustomer?.fullName || 'Customer',
            mobile: cleanMobile || currentCustomer?.mobile || '0000000000',
            email: cleanEmail || (cleanMobile ? `${cleanMobile}@customer.portal` : currentCustomer?.email || ''),
            panNumber: panNumber !== undefined ? String(panNumber).trim() || undefined : currentCustomer?.panNumber,
            bankAccount: bankAccount !== undefined ? String(bankAccount).trim() || undefined : currentCustomer?.bankAccount,
            executiveName: executiveName !== undefined ? String(executiveName).trim() || undefined : currentCustomer?.executiveName,
            createdByAdminId: req.adminUser!.id,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          customers.unshift(matched);
        }
        link.customerId = matched.id;
      } else if (currentCustomer) {
        if (customerName !== undefined) currentCustomer.fullName = cleanName;
        if (customerMobile !== undefined) currentCustomer.mobile = cleanMobile;
        if (customerEmail !== undefined) currentCustomer.email = cleanEmail;
        currentCustomer.updatedAt = nowIso;
      }
      customersDirty = true;
      changeSummary.push(`Customer updated (${cleanName})`);
    }
  }

  // 8. KYC & Link Metadata Fields
  if (description !== undefined) link.description = String(description).trim();
  if (loanOrderNumber !== undefined) link.loanOrderNumber = String(loanOrderNumber).trim() || undefined;
  if (repaymentDate !== undefined) link.repaymentDate = String(repaymentDate).trim() || undefined;
  if (panNumber !== undefined) link.panNumber = String(panNumber).trim().toUpperCase() || undefined;
  if (bankAccount !== undefined) link.bankAccount = String(bankAccount).trim() || undefined;
  if (executiveName !== undefined) link.executiveName = String(executiveName).trim() || undefined;
  if (externalReference !== undefined) link.externalReference = String(externalReference).trim() || undefined;

  // Sync optional KYC onto the linked customer when appropriate
  const linkedCustomer = customers.find((c) => c.id === link.customerId);
  if (linkedCustomer) {
    if (panNumber !== undefined && String(panNumber).trim()) {
      linkedCustomer.panNumber = String(panNumber).trim().toUpperCase();
      customersDirty = true;
    }
    if (bankAccount !== undefined && String(bankAccount).trim()) {
      linkedCustomer.bankAccount = String(bankAccount).trim();
      customersDirty = true;
    }
    if (executiveName !== undefined && String(executiveName).trim()) {
      linkedCustomer.executiveName = String(executiveName).trim();
      customersDirty = true;
    }
  }

  // 9. Expiry & Link Enable Toggle
  if (expiresAt !== undefined && String(expiresAt).trim() !== '') {
    const parsedDate = new Date(expiresAt);
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ success: false, error: 'Invalid expiry date/time format.' });
      return;
    }
    link.expiresAt = parsedDate.toISOString();
    if (parsedDate.getTime() > Date.now() && link.status === 'EXPIRED') {
      link.status = 'CREATED';
    }
    changeSummary.push('Expiry updated');
  } else if (expiresInHours !== undefined && expiresInHours !== null && String(expiresInHours).trim() !== '') {
    const hours = parseFloat(String(expiresInHours));
    if (!Number.isFinite(hours) || hours <= 0) {
      res.status(400).json({ success: false, error: 'Validity hours must be greater than zero.' });
      return;
    }
    link.expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    if (link.status === 'EXPIRED') {
      link.status = 'CREATED';
    }
    changeSummary.push(`Validity extended (+${hours}h)`);
  }

  if (isEnabled !== undefined) {
    link.isEnabled = Boolean(isEnabled);
  }

  // 10. WhatsApp / OpenGraph Social Preview
  if (ogTitle !== undefined) link.ogTitle = ogTitle ? String(ogTitle).trim() : undefined;
  if (ogDescription !== undefined) link.ogDescription = ogDescription ? String(ogDescription).trim() : undefined;
  const resolvedOgImg = ogImageUrl !== undefined ? ogImageUrl : ogImage;
  if (resolvedOgImg !== undefined) {
    link.ogImageUrl = resolvedOgImg ? String(resolvedOgImg).trim() : undefined;
    link.ogImage = link.ogImageUrl;
  }

  link.updatedAt = nowIso;

  if (customersDirty) Database.saveCustomers(customers);
  Database.savePaymentLinks(links);
  Database.savePaymentStatusHistory(history);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'PAYMENT_LINK_UPDATED',
    entityType: 'PAYMENT_LINK',
    entityId: link.id,
    details:
      changeSummary.length > 0
        ? `Edited link ${link.token}: ${changeSummary.join(', ')}`
        : `Updated payment link ${link.token} details`,
  });

  const brand = brands.find((b) => b.id === link.brandId);
  const customer = customers.find((c) => c.id === link.customerId);
  const gateway = gateways.find((g) => g.id === link.gatewayAccountId);
  const creator = Database.getAdmins().find((a) => a.id === link.createdByAdminId);

  res.json({
    success: true,
    link: {
      ...link,
      customerName: customer?.fullName || 'Customer',
      customerMobile: customer?.mobile || '',
      customerEmail: customer?.email || '',
      brandName: brand?.name || 'Loan Services',
      brandSlug: brand?.slug || 'pay',
      brandLogo: brand?.logoUrl,
      gatewayName: gateway?.name || 'N/A',
      gatewayAdapter: gateway?.adapter || 'eaglepay',
      isExpired: new Date(link.expiresAt).getTime() < Date.now(),
      createdByName: creator?.name || creator?.username || 'Administrator',
      createdByUsername: creator?.username || 'admin',
      publicUrl: `/${brand?.slug || 'pay'}/pay/${link.token}`,
    },
  });
});

// DELETE /api/payment-links/:id
paymentLinkRouter.delete('/:id', requireAuth(['operator', 'link_creator']), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  const links = Database.getPaymentLinks();
  const existing = links.find((l) => l.id === id || l.token === id);

  if (!existing) {
    res.status(404).json({ success: false, error: 'Payment link not found.' });
    return;
  }

  if (!isPrivileged && existing.createdByAdminId !== req.adminUser!.id) {
    res.status(403).json({ success: false, error: 'Access denied. You can only delete payment links created by you.' });
    return;
  }

  const filtered = links.filter((l) => l.id !== existing.id);
  Database.savePaymentLinks(filtered);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'PAYMENT_LINK_DELETED',
    entityType: 'PAYMENT_LINK',
    entityId: existing.id,
    details: `Deleted payment link ${existing.token} (${existing.merchantOrderNo})`,
  });

  res.json({ success: true, message: 'Payment link deleted successfully.' });
});

// POST /api/payment-links/bulk-delete
paymentLinkRouter.post('/bulk-delete', requireAuth(['operator', 'link_creator']), (req: AuthenticatedRequest, res: Response): void => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ success: false, error: 'Array of link IDs is required.' });
    return;
  }

  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  const idSet = new Set(ids);
  const links = Database.getPaymentLinks();

  // If not privileged, prevent deleting links that do not belong to current user
  const targetLinks = links.filter((l) => idSet.has(l.id) || idSet.has(l.token));
  if (!isPrivileged) {
    const hasOtherLinks = targetLinks.some((l) => l.createdByAdminId !== req.adminUser!.id);
    if (hasOtherLinks) {
      res.status(403).json({ success: false, error: 'Access denied. You can only bulk delete links you created.' });
      return;
    }
  }

  const filtered = links.filter((l) => !idSet.has(l.id) && !idSet.has(l.token));
  const deletedCount = links.length - filtered.length;

  Database.savePaymentLinks(filtered);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'PAYMENT_LINK_BULK_DELETED',
    entityType: 'PAYMENT_LINK',
    details: `Bulk deleted ${deletedCount} payment links`,
  });

  res.json({ success: true, deletedCount, message: `Successfully deleted ${deletedCount} link(s).` });
});

// PATCH /api/payment-links/:id/toggle
paymentLinkRouter.patch('/:id/toggle', requireAuth('operator'), (req: AuthenticatedRequest, res: Response): void => {
  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  const links = Database.getPaymentLinks();
  const link = links.find((l) => l.id === req.params.id);

  if (!link) {
    res.status(404).json({ success: false, error: 'Payment link not found.' });
    return;
  }

  if (!isPrivileged && link.createdByAdminId !== req.adminUser!.id) {
    res.status(403).json({ success: false, error: 'Access denied. You can only toggle payment links created by you.' });
    return;
  }

  link.isEnabled = !link.isEnabled;
  link.updatedAt = new Date().toISOString();
  Database.savePaymentLinks(links);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: link.isEnabled ? 'PAYMENT_LINK_ENABLED' : 'PAYMENT_LINK_DISABLED',
    entityType: 'PAYMENT_LINK',
    entityId: link.id,
    details: `${link.isEnabled ? 'Enabled' : 'Disabled'} payment link ${link.token}`,
  });

  res.json({ success: true, isEnabled: link.isEnabled });
});

// POST /api/payment-links/:id/recheck
paymentLinkRouter.post('/:id/recheck', requireAuth('operator'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = await PaymentOrchestrator.queryAndUpdateStatus(req.params.id, req.adminUser!.username);
  res.json(result);
});

// POST /api/payment-links/:id/manual-verify
paymentLinkRouter.post('/:id/manual-verify', requireAuth(['operator', 'admin']), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { action, note, utrNumber } = req.body || {};

  if (action !== 'approve' && action !== 'reject') {
    res.status(400).json({ success: false, error: 'Action must be "approve" or "reject".' });
    return;
  }

  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  const existing = Database.getPaymentLinks().find((l) => l.id === id || l.token === id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Payment link not found.' });
    return;
  }
  if (!isPrivileged && existing.createdByAdminId !== req.adminUser!.id) {
    res.status(403).json({ success: false, error: 'Access denied for this payment link.' });
    return;
  }

  const result = PaymentOrchestrator.verifyManualPayment(existing.id, {
    action,
    note,
    utrNumber,
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
  });

  if (!result.success || !result.link) {
    res.status(400).json({ success: false, error: result.error || 'Verification failed.' });
    return;
  }

  res.json({ success: true, link: result.link });
});

// GET /api/payment-links/:id/tracking
paymentLinkRouter.get('/:id/tracking', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  const links = Database.getPaymentLinks();
  const link = links.find((l) => l.id === id || l.token === id);

  if (!link) {
    res.status(404).json({ success: false, error: 'Payment link not found.' });
    return;
  }

  if (!isPrivileged && link.createdByAdminId !== req.adminUser!.id) {
    res.status(403).json({ success: false, error: 'Access denied. You can only view tracking for links created by you.' });
    return;
  }

  const account = Database.getGatewayAccounts().find((a) => a.id === link.gatewayAccountId);

  res.json({
    success: true,
    tracking: {
      linkId: link.id,
      token: link.token,
      merchantOrderNo: link.merchantOrderNo,
      status: link.status,
      amountFormatted: link.amountFormatted,
      viewCount: link.viewCount || 0,
      lastViewedAt: link.lastViewedAt || null,
      clickCount: link.clickCount || 0,
      lastClickedAt: link.lastClickedAt || null,
      gatewayOrderNo: link.gatewayOrderNo || link.currentGatewayMchOrderNo || null,
      gatewayAdapter: account?.adapter || 'eaglepay',
      visitorEvents: link.visitorEvents || [],
      orderAttempts: link.orderAttempts || [],
    },
  });
});
