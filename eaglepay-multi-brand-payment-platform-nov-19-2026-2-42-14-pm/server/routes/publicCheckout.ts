import { Router, Request, Response } from 'express';
import { Database, DEFAULT_MANUAL_GATEWAY_CONFIG, DEFAULT_HOME_PAGE_CONFIG } from '../db/database.js';
import { PaymentOrchestrator } from '../services/PaymentOrchestrator.js';
import { TemplateEngine } from '../services/TemplateEngine.js';

export const publicCheckoutRouter = Router();

// GET /api/public/home - Public informational homepage configuration
publicCheckoutRouter.get('/home', (_req: Request, res: Response): void => {
  const settings = Database.getSystemSettings();
  const config = {
    ...DEFAULT_HOME_PAGE_CONFIG,
    ...(settings.homePageConfig || {}),
  };
  res.json({
    success: true,
    config,
  });
});

// GET /api/public/checkout/:token
publicCheckoutRouter.get('/checkout/:token', (req: Request, res: Response): void => {
  const { token } = req.params;
  const links = Database.getPaymentLinks();
  const link = links.find((l) => l.token === token);

  if (!link) {
    res.status(404).json({ success: false, error: 'Payment link not found.' });
    return;
  }

  const brands = Database.getBrands();
  const brand = brands.find((b) => b.id === link.brandId);
  const customers = Database.getCustomers();
  const customer = customers.find((c) => c.id === link.customerId);
  const templates = Database.getTemplates();
  const template = templates.find((t) => t.id === brand?.currentTemplateId) || templates[0];

  const isExpired = new Date(link.expiresAt).getTime() < Date.now();
  const currentStatus = isExpired && link.status !== 'SUCCESS' ? 'EXPIRED' : link.status;

  const repaymentDate = link.repaymentDate || new Date(link.expiresAt).toLocaleDateString('en-GB');
  const loanOrderNo = link.loanOrderNumber || link.merchantOrderNo;
  const pan = link.panNumber || customer?.panNumber;
  const bankAccount = link.bankAccount || customer?.bankAccount;
  const executiveName = link.executiveName || customer?.executiveName;

  // Render template HTML safely
  const renderedHtml = template
    ? TemplateEngine.render(template.htmlContent, {
        payment: {
          amount: link.amountFormatted,
          order_number: link.merchantOrderNo,
          loan_order_number: loanOrderNo,
          repayment_date: repaymentDate,
          status: currentStatus === 'PENDING' ? 'Link Pending' : currentStatus,
          created_at: new Date(link.createdAt).toLocaleDateString('en-GB'),
          expires_at: new Date(link.expiresAt).toLocaleDateString('en-GB'),
          reference: link.externalReference || 'N/A',
        },
        customer: {
          name: customer?.fullName || 'Valued Customer',
          mobile: customer?.mobile || '',
          email: customer?.email || '',
          pan,
          bank_account: bankAccount,
          executive_name: executiveName,
          address: customer?.address || '',
          city: customer?.city || '',
          state: customer?.state || '',
          pincode: customer?.pincode || '',
        },
        brand: {
          name: brand?.name || 'Payment Portal',
          logo: brand?.logoUrl || '',
          primary_color: brand?.primaryColor || '#6366f1',
          secondary_color: brand?.secondaryColor || '#818cf8',
          button_color: brand?.buttonColor || brand?.primaryColor || '#6366f1',
          button_text: brand?.buttonText || 'PAY NOW',
          support_email: brand?.supportEmail || '',
          support_phone: brand?.supportPhone || '',
        },
        site: {
          name: brand?.name || 'Payment Portal',
          url: Database.getSystemSettings().siteUrl || '',
        },
      })
    : '';

  // Record visitor analytics
  const userAgent = req.get('user-agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const isTablet = /iPad|Tablet/i.test(userAgent);
  const deviceType = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
  const referrer = req.get('referer') || req.get('referrer') || 'Direct / WhatsApp';
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();

  link.viewCount = (link.viewCount || 0) + 1;
  link.lastViewedAt = new Date().toISOString();

  const visitorEvents = Array.isArray(link.visitorEvents) ? [...link.visitorEvents] : [];
  visitorEvents.unshift({
    id: 'evt_' + Math.random().toString(36).slice(2, 8),
    eventType: 'LINK_VIEWED',
    timestamp: new Date().toISOString(),
    ipAddress: ip,
    userAgent: userAgent.slice(0, 150),
    deviceType,
    referrer: referrer.includes('whatsapp') ? 'WhatsApp Link Click' : referrer.slice(0, 100),
  });
  link.visitorEvents = visitorEvents.slice(0, 50); // keep last 50
  Database.savePaymentLinks(links);

  const accounts = Database.getGatewayAccounts();
  const account = accounts.find((a) => a.id === link.gatewayAccountId);
  const isManualGateway = account?.adapter === 'manual';

  const manualConfig = isManualGateway
    ? {
        ...DEFAULT_MANUAL_GATEWAY_CONFIG,
        ...(account?.extraConfig?.manualConfig || {}),
      }
    : undefined;

  const safeManualSubmission =
    isManualGateway && link.manualSubmission
      ? {
          id: link.manualSubmission.id,
          utrNumber: link.manualSubmission.utrNumber,
          payerNote: link.manualSubmission.payerNote,
          amountPaid: link.manualSubmission.amountPaid,
          submittedAt: link.manualSubmission.submittedAt,
          status: link.manualSubmission.status,
          reviewedAt: link.manualSubmission.reviewedAt,
          reviewNote: link.manualSubmission.reviewNote,
        }
      : undefined;

  res.json({
    success: true,
    data: {
      link: {
        token: link.token,
        amount: link.amount,
        amountFormatted: link.amountFormatted,
        currency: link.currency,
        description: link.description,
        externalReference: link.externalReference,
        panNumber: pan,
        bankAccount,
        executiveName,
        loanOrderNumber: loanOrderNo,
        repaymentDate,
        merchantOrderNo: link.merchantOrderNo,
        status: currentStatus,
        isEnabled: link.isEnabled,
        expiresAt: link.expiresAt,
        paidAt: link.paidAt,
        gatewayPayUrl: link.gatewayPayUrl,
        gatewayOrderNo: link.gatewayOrderNo,
        currentGatewayMchOrderNo: link.currentGatewayMchOrderNo,
        gatewayAdapter: account?.adapter || 'eaglepay',
        orderAttempts: link.orderAttempts || [],
        manualSubmission: safeManualSubmission,
      },
      customer: {
        name: customer?.fullName || 'Valued Customer',
        email: customer?.email,
        mobile: customer?.mobile,
        panNumber: pan,
        bankAccount,
        executiveName,
      },
      brand: {
        name: brand?.name || 'Payment Portal',
        slug: brand?.slug || 'pay',
        logoUrl: brand?.logoUrl,
        primaryColor: brand?.primaryColor || '#6366f1',
        secondaryColor: brand?.secondaryColor || '#818cf8',
        backgroundColor: brand?.backgroundColor || '#f3f4f6',
        buttonColor: brand?.buttonColor || '#6366f1',
        buttonText: brand?.buttonText || 'PAY NOW',
        successTitle: brand?.successTitle || 'Payment Successful',
        successMessage: brand?.successMessage || 'Your payment has been received and verified successfully.',
        pendingTitle: brand?.pendingTitle || 'Payment Processing',
        pendingMessage: brand?.pendingMessage || 'Your payment is currently being processed by the banking system.',
        failedTitle: brand?.failedTitle || 'Payment Unsuccessful',
        failedMessage: brand?.failedMessage || 'Transaction could not be completed. Please try again.',
        supportEmail: brand?.supportEmail,
        supportPhone: brand?.supportPhone,
      },
      manualConfig,
      renderedHtml,
    },
  });
});

// POST /api/public/checkout/:token/pay
publicCheckoutRouter.post('/checkout/:token/pay', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const originUrl = `${protocol}://${host}`;

  const result = await PaymentOrchestrator.initiateCheckout(token, originUrl);

  if (!result.success) {
    res.status(400).json({ success: false, status: result.status, error: result.error });
    return;
  }

  const updatedLink = Database.getPaymentLinks().find((l) => l.token === token);

  res.json({
    success: true,
    mode: result.mode || 'redirect',
    payUrl: result.payUrl,
    isSimulated: result.isSimulated,
    status: result.status,
    gatewayOrderNo: updatedLink?.gatewayOrderNo,
    mchOrderNo: updatedLink?.currentGatewayMchOrderNo || updatedLink?.merchantOrderNo,
    orderAttempts: updatedLink?.orderAttempts || [],
  });
});

// POST /api/public/checkout/:token/manual-submit
publicCheckoutRouter.post('/checkout/:token/manual-submit', (req: Request, res: Response): void => {
  const { token } = req.params;
  const { utrNumber, screenshotDataUrl, payerNote } = req.body || {};
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();

  const result = PaymentOrchestrator.submitManualProof(token, {
    utrNumber,
    screenshotDataUrl,
    payerNote,
    submittedIp: ip,
  });

  if (!result.success || !result.link) {
    res.status(400).json({ success: false, error: result.error || 'Failed to submit payment proof.' });
    return;
  }

  res.json({
    success: true,
    status: result.link.status,
    manualSubmission: result.link.manualSubmission
      ? {
          id: result.link.manualSubmission.id,
          utrNumber: result.link.manualSubmission.utrNumber,
          payerNote: result.link.manualSubmission.payerNote,
          submittedAt: result.link.manualSubmission.submittedAt,
          status: result.link.manualSubmission.status,
        }
      : undefined,
  });
});

// POST /api/public/checkout/:token/check-status
publicCheckoutRouter.post('/checkout/:token/check-status', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const link = Database.getPaymentLinks().find((l) => l.token === token);

  if (!link) {
    res.status(404).json({ success: false, error: 'Payment link not found.' });
    return;
  }

  const result = await PaymentOrchestrator.queryAndUpdateStatus(link.id, 'Customer Status Poll');
  res.json(result);
});
