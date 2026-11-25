import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware.js';
import { Database } from '../db/database.js';
import { Customer } from '../types.js';
import { ExportService } from '../services/ExportService.js';

export const customerRouter = Router();

// GET /api/customers
customerRouter.get('/', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const { search, createdByAdminId } = req.query;
  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  let customers = Database.getCustomers();
  const allLinks = Database.getPaymentLinks();

  // Role-based customer isolation: Team members (link creators) only see customers they created or have links for
  if (!isPrivileged) {
    const userCustIds = new Set(allLinks.filter((l) => l.createdByAdminId === req.adminUser!.id).map((l) => l.customerId));
    customers = customers.filter((c) => c.createdByAdminId === req.adminUser!.id || userCustIds.has(c.id));
  } else if (createdByAdminId && typeof createdByAdminId === 'string' && createdByAdminId !== 'ALL') {
    const memberCustIds = new Set(allLinks.filter((l) => l.createdByAdminId === createdByAdminId).map((l) => l.customerId));
    customers = customers.filter((c) => c.createdByAdminId === createdByAdminId || memberCustIds.has(c.id));
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    customers = customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        (c.externalReference && c.externalReference.toLowerCase().includes(q))
    );
  }

  // Count payment links per customer
  const admins = Database.getAdmins();
  const enhanced = customers.map((c) => {
    // If not privileged, only count this user's links
    const relevantLinks = !isPrivileged
      ? allLinks.filter((l) => l.customerId === c.id && l.createdByAdminId === req.adminUser!.id)
      : allLinks.filter((l) => l.customerId === c.id);
    const paidLinks = relevantLinks.filter((l) => l.status === 'SUCCESS');
    const totalPaid = paidLinks.reduce((sum, l) => sum + l.amount, 0);
    const creator = admins.find((a) => a.id === c.createdByAdminId);

    return {
      ...c,
      totalLinks: relevantLinks.length,
      paidLinks: paidLinks.length,
      totalPaidAmount: Math.round(totalPaid * 100) / 100,
      createdByName: creator?.name || creator?.username || (c.createdByAdminId ? 'Team Member' : 'Administrator'),
      createdByUsername: creator?.username || (c.createdByAdminId ? 'user' : 'admin'),
    };
  });

  res.json({ success: true, customers: enhanced });
});

// GET /api/customers/:id
customerRouter.get('/:id', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const customer = Database.getCustomers().find((c) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: 'Customer not found.' });
    return;
  }

  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  const allLinks = Database.getPaymentLinks();
  if (!isPrivileged) {
    const hasUserLink = allLinks.some((l) => l.customerId === customer.id && l.createdByAdminId === req.adminUser!.id);
    if (customer.createdByAdminId !== req.adminUser!.id && !hasUserLink) {
      res.status(403).json({ success: false, error: 'Access denied. You can only view customers associated with your account.' });
      return;
    }
  }

  const links = !isPrivileged
    ? allLinks.filter((l) => l.customerId === customer.id && l.createdByAdminId === req.adminUser!.id)
    : allLinks.filter((l) => l.customerId === customer.id);

  res.json({ success: true, customer, links });
});

// POST /api/customers
customerRouter.post('/', requireAuth('operator'), (req: AuthenticatedRequest, res: Response): void => {
  const { fullName, mobile, email, panNumber, bankAccount, executiveName, externalReference, businessReference, notes } = req.body;

  if (!fullName || !mobile || !email) {
    res.status(400).json({ success: false, error: 'Full name, mobile number, and email are required.' });
    return;
  }

  // Mobile validation
  const cleanMobile = mobile.replace(/[^0-9+]/g, '');
  if (cleanMobile.length < 10) {
    res.status(400).json({ success: false, error: 'A valid mobile number is required.' });
    return;
  }

  const customers = Database.getCustomers();
  // Check duplicate email or mobile
  const duplicate = customers.find(
    (c) => c.email.toLowerCase() === email.toLowerCase() || c.mobile === cleanMobile
  );
  if (duplicate) {
    res.status(409).json({ success: false, error: 'A customer with this email or mobile number already exists.' });
    return;
  }

  const newCustomer: Customer = {
    id: 'cust_' + crypto.randomBytes(6).toString('hex'),
    fullName: fullName.trim(),
    mobile: cleanMobile,
    email: email.trim().toLowerCase(),
    panNumber: panNumber?.trim() || undefined,
    bankAccount: bankAccount?.trim() || undefined,
    executiveName: executiveName?.trim() || undefined,
    externalReference: externalReference?.trim() || undefined,
    businessReference: businessReference?.trim() || undefined,
    notes: notes?.trim() || undefined,
    createdByAdminId: req.adminUser!.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  customers.unshift(newCustomer);
  Database.saveCustomers(customers);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'CUSTOMER_CREATED',
    entityType: 'CUSTOMER',
    entityId: newCustomer.id,
    details: `Added customer ${newCustomer.fullName} (${newCustomer.mobile})`,
  });

  res.status(201).json({ success: true, customer: newCustomer });
});

// PUT /api/customers/:id
customerRouter.put('/:id', requireAuth('operator'), (req: AuthenticatedRequest, res: Response): void => {
  const { fullName, mobile, email, panNumber, bankAccount, executiveName, externalReference, businessReference, notes } = req.body;
  const customers = Database.getCustomers();
  const customer = customers.find((c) => c.id === req.params.id);

  if (!customer) {
    res.status(404).json({ success: false, error: 'Customer not found.' });
    return;
  }

  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  if (!isPrivileged) {
    const allLinks = Database.getPaymentLinks();
    const hasUserLink = allLinks.some((l) => l.customerId === customer.id && l.createdByAdminId === req.adminUser!.id);
    if (customer.createdByAdminId !== req.adminUser!.id && !hasUserLink) {
      res.status(403).json({ success: false, error: 'Access denied. You can only update customers associated with your account.' });
      return;
    }
  }

  if (fullName) customer.fullName = fullName.trim();
  if (mobile) customer.mobile = mobile.replace(/[^0-9+]/g, '');
  if (email) customer.email = email.trim().toLowerCase();
  if (panNumber !== undefined) customer.panNumber = panNumber?.trim() || undefined;
  if (bankAccount !== undefined) customer.bankAccount = bankAccount?.trim() || undefined;
  if (executiveName !== undefined) customer.executiveName = executiveName?.trim() || undefined;
  if (externalReference !== undefined) customer.externalReference = externalReference?.trim() || undefined;
  if (businessReference !== undefined) customer.businessReference = businessReference?.trim() || undefined;
  if (notes !== undefined) customer.notes = notes?.trim() || undefined;
  customer.updatedAt = new Date().toISOString();

  Database.saveCustomers(customers);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'CUSTOMER_UPDATED',
    entityType: 'CUSTOMER',
    entityId: customer.id,
    details: `Updated details for customer ${customer.fullName}`,
  });

  res.json({ success: true, customer });
});

// DELETE /api/customers/:id
customerRouter.delete('/:id', requireAuth('operator'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const customers = Database.getCustomers();
  const existing = customers.find((c) => c.id === id);

  if (!existing) {
    res.status(404).json({ success: false, error: 'Customer not found.' });
    return;
  }

  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  if (!isPrivileged) {
    const allLinks = Database.getPaymentLinks();
    const hasUserLink = allLinks.some((l) => l.customerId === existing.id && l.createdByAdminId === req.adminUser!.id);
    if (existing.createdByAdminId !== req.adminUser!.id && !hasUserLink) {
      res.status(403).json({ success: false, error: 'Access denied. You can only delete customers associated with your account.' });
      return;
    }
  }

  const filtered = customers.filter((c) => c.id !== id);
  Database.saveCustomers(filtered);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'CUSTOMER_DELETED',
    entityType: 'CUSTOMER',
    entityId: id,
    details: `Deleted customer ${existing.fullName} (${existing.mobile})`,
  });

  res.json({ success: true, message: 'Customer deleted successfully.' });
});

// POST /api/customers/bulk-delete
customerRouter.post('/bulk-delete', requireAuth('operator'), (req: AuthenticatedRequest, res: Response): void => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ success: false, error: 'Array of customer IDs is required.' });
    return;
  }

  const isPrivileged = ['super_admin', 'admin', 'manager'].includes(req.adminUser!.role);
  const idSet = new Set(ids);
  const customers = Database.getCustomers();

  if (!isPrivileged) {
    const allLinks = Database.getPaymentLinks();
    const targetCusts = customers.filter((c) => idSet.has(c.id));
    const hasUnauthorized = targetCusts.some((c) => {
      const hasLink = allLinks.some((l) => l.customerId === c.id && l.createdByAdminId === req.adminUser!.id);
      return c.createdByAdminId !== req.adminUser!.id && !hasLink;
    });
    if (hasUnauthorized) {
      res.status(403).json({ success: false, error: 'Access denied. You can only delete customers associated with your account.' });
      return;
    }
  }

  const filtered = customers.filter((c) => !idSet.has(c.id));
  const deletedCount = customers.length - filtered.length;

  Database.saveCustomers(filtered);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'CUSTOMER_BULK_DELETED',
    entityType: 'CUSTOMER',
    details: `Bulk deleted ${deletedCount} customers`,
  });

  res.json({ success: true, deletedCount, message: `Successfully deleted ${deletedCount} customer(s).` });
});

// GET /api/customers/export/csv
customerRouter.get('/export/csv', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const customers = Database.getCustomers();
  const csvData = ExportService.toCsv(
    customers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      mobile: c.mobile,
      email: c.email,
      externalReference: c.externalReference || '',
      businessReference: c.businessReference || '',
      createdAt: c.createdAt,
    })),
    [
      { key: 'id', label: 'Customer ID' },
      { key: 'fullName', label: 'Full Name' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'email', label: 'Email' },
      { key: 'externalReference', label: 'External Ref' },
      { key: 'businessReference', label: 'Business Ref' },
      { key: 'createdAt', label: 'Created At' },
    ]
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="customers_export.csv"');
  res.send(csvData);
});
