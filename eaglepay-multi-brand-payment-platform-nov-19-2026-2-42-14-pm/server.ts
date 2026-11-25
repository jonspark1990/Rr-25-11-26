import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'node:fs';
import { Database } from './server/db/database.js';
import { authRouter } from './server/routes/auth.js';
import { dashboardRouter } from './server/routes/dashboard.js';
import { customerRouter } from './server/routes/customers.js';
import { paymentLinkRouter } from './server/routes/paymentLinks.js';
import { brandRouter } from './server/routes/brands.js';
import { gatewayRouter } from './server/routes/gatewayAccounts.js';
import { webhookRouter } from './server/routes/webhooks.js';
import { reportRouter } from './server/routes/reports.js';
import { auditLogRouter } from './server/routes/auditLogs.js';
import { testRouter } from './server/routes/tests.js';
import { systemRouter } from './server/routes/system.js';
import { publicCheckoutRouter } from './server/routes/publicCheckout.js';
import { noticeTemplatesRouter } from './server/routes/noticeTemplates.js';
import { SignatureService } from './server/services/SignatureService.js';
import { PaymentOrchestrator } from './server/services/PaymentOrchestrator.js';

const app = express();
app.disable('x-powered-by');

const PORT = process.env.PORT && process.env.PORT !== '8080' ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Initialize Database schema and seeds
Database.initialize();

// Parse JSON bodies with raw body capture for webhooks (25mb limit for bulk import backups)
app.use(
  express.json({
    limit: '25mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Enterprise Security Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Dedicated Webhook Router: /webhooks/eaglepay
app.use('/webhooks', webhookRouter);

// API Routers
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/customers', customerRouter);
app.use('/api/payment-links', paymentLinkRouter);
app.use('/api/brands', brandRouter);
app.use('/api/gateway-accounts', gatewayRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/reports', reportRouter);
app.use('/api/audit-logs', auditLogRouter);
app.use('/api/tests', testRouter);
app.use('/api/system', systemRouter);
app.use('/api/public', publicCheckoutRouter);
app.use('/api/notice-templates', noticeTemplatesRouter);

// Sandbox Gateway Simulator Page
// Provides realistic browser checkout redirect experience during testing
app.get('/__sandbox_gateway_simulator', (req: Request, res: Response) => {
  const { orderNo, mchOrderNo, amount } = req.query;
  const links = Database.getPaymentLinks();
  const link = links.find((l) => l.merchantOrderNo === mchOrderNo);
  const brand = Database.getBrands().find((b) => b.id === link?.brandId);

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Eagle Pay Sandbox Gateway Simulator</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl">
    <div class="flex items-center justify-between pb-4 border-b border-slate-700">
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
        <span class="font-bold text-sm tracking-wide text-emerald-400">EAGLE PAY SANDBOX SIMULATOR</span>
      </div>
      <span class="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">SIMULATION</span>
    </div>

    <div class="my-6 space-y-3">
      <div class="bg-slate-900/60 p-4 rounded-xl space-y-1.5 border border-slate-700/50">
        <div class="text-xs text-slate-400">Merchant Reference</div>
        <div class="font-mono text-sm font-semibold text-slate-200">${mchOrderNo || 'N/A'}</div>
        <div class="text-xs text-slate-400 mt-2">Gateway Order No</div>
        <div class="font-mono text-xs text-slate-400">${orderNo || 'N/A'}</div>
        <div class="text-xs text-slate-400 mt-2">Amount Payable</div>
        <div class="text-3xl font-extrabold text-emerald-400 font-mono">₹${amount || '0.00'}</div>
      </div>

      <div class="text-xs text-slate-400 p-3 bg-slate-800/80 rounded-lg border border-slate-700">
        This is a safe sandbox simulator for development. In production, this redirects to the real Eagle Pay hosted page.
      </div>
    </div>

    <form method="POST" action="/__sandbox_gateway_simulator/complete" class="space-y-3">
      <input type="hidden" name="orderNo" value="${orderNo || ''}">
      <input type="hidden" name="mchOrderNo" value="${mchOrderNo || ''}">
      <input type="hidden" name="amount" value="${amount || '0.00'}">
      <input type="hidden" name="returnUrl" value="/${brand?.slug || 'pay'}/${link?.token || ''}">

      <button type="submit" name="action" value="success" class="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition shadow-lg flex items-center justify-center gap-2">
        Simulate Successful Payment
      </button>

      <button type="submit" name="action" value="fail" class="w-full py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium transition text-sm">
        Simulate Payment Failure
      </button>
    </form>
  </div>
</body>
</html>
  `);
});

// Handle sandbox payment simulation action
app.post('/__sandbox_gateway_simulator/complete', async (req: Request, res: Response) => {
  const { orderNo, mchOrderNo, amount, returnUrl, action } = req.body;
  const links = Database.getPaymentLinks();
  const link = links.find((l) => l.merchantOrderNo === mchOrderNo);

  if (link) {
    const accounts = Database.getGatewayAccounts();
    const account = accounts.find((a) => a.id === link.gatewayAccountId);
    const secret = account?.mchKey || 'MCH_SANDBOX_SECRET_KEY_99';

    const payload: Record<string, unknown> = {
      mchId: account?.mchId || 'MCH_EAGLE_SANDBOX_001',
      orderNo: orderNo || `SIM-${Date.now()}`,
      mchOrderNo: link.merchantOrderNo,
      amount: amount || link.amountFormatted,
      status: action === 'success' ? 'success' : 'failed',
      currency: 'INR',
      paidAt: new Date().toISOString(),
    };

    const { signature } = SignatureService.generateSignature(payload, secret);
    payload.sign = signature;

    // Trigger internal webhook processing
    await PaymentOrchestrator.processWebhook(payload, JSON.stringify(payload), 'mock');
  }

  res.redirect(returnUrl || '/');
});

// Helper to generate dynamic Open Graph / WhatsApp Preview HTML for payment links
function getBrandedCheckoutHtml(token: string, req: Request): string | null {
  const links = Database.getPaymentLinks();
  const link = links.find((l) => l.token === token || l.id === token);
  if (!link) return null;

  const brands = Database.getBrands();
  const brand = brands.find((b) => b.id === link.brandId);
  const customers = Database.getCustomers();
  const customer = customers.find((c) => c.id === link.customerId);
  const sysSettings = Database.getSystemSettings();

  const brandName = brand?.name || 'Secure Pay';
  const customerName = customer?.fullName || 'Customer';
  const amountStr = `₹${link.amountFormatted}`;
  const orderNo = link.loanOrderNumber || link.merchantOrderNo;

  const resolveVars = (tpl: string) => {
    return tpl
      .replace(/{{brandName}}/g, brandName)
      .replace(/{{customerName}}/g, customerName)
      .replace(/{{amount}}/g, amountStr)
      .replace(/{{orderNo}}/g, orderNo)
      .replace(/{{token}}/g, link.token);
  };

  const ogTitle = link.ogTitle
    ? resolveVars(link.ogTitle)
    : brand?.ogTitle
    ? resolveVars(brand.ogTitle)
    : sysSettings.defaultOgTitle
    ? resolveVars(sysSettings.defaultOgTitle)
    : `${brandName} - Pay ${amountStr}`;

  const ogDesc = link.ogDescription
    ? resolveVars(link.ogDescription)
    : brand?.ogDescription
    ? resolveVars(brand.ogDescription)
    : sysSettings.defaultOgDescription
    ? resolveVars(sysSettings.defaultOgDescription)
    : `Official payment request for ${customerName} • Order #${orderNo}. Click to pay ${amountStr} securely.`;

  const ogImage =
    link.ogImageUrl ||
    brand?.ogImageUrl ||
    brand?.logoUrl ||
    sysSettings.defaultOgImageUrl ||
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80';

  const host = req.get('host') || 'localhost:3000';
  const proto = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const fullUrl = `${proto}://${host}${req.originalUrl}`;

  const htmlPath = path.resolve(process.cwd(), isProduction ? 'dist/index.html' : 'index.html');
  if (!fs.existsSync(htmlPath)) return null;

  let html = fs.readFileSync(htmlPath, 'utf-8');

  const escTitle = ogTitle.replace(/"/g, '&quot;');
  const escDesc = ogDesc.replace(/"/g, '&quot;');
  const escImage = ogImage.replace(/"/g, '&quot;');
  const escUrl = fullUrl.replace(/"/g, '&quot;');

  html = html.replace(/<title>.*?<\/title>/i, `<title>${escTitle}</title>`);
  html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${escDesc}" />`);
  html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${escTitle}" />`);
  html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${escDesc}" />`);

  const extraMeta = `
    <meta property="og:image" content="${escImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${escUrl}" />
    <meta property="og:site_name" content="${brandName}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escTitle}" />
    <meta name="twitter:description" content="${escDesc}" />
    <meta name="twitter:image" content="${escImage}" />`;

  return html.replace('</head>', `${extraMeta}\n  </head>`);
}

// WhatsApp & Social Link Preview Handler
const socialPreviewHandler = async (req: Request, res: Response, next: express.NextFunction) => {
  // Never intercept source files, node modules, vite internal URLs, or static assets with extensions
  if (
    req.path.startsWith('/src') ||
    req.path.startsWith('/node_modules') ||
    req.path.startsWith('/@') ||
    req.path.startsWith('/api') ||
    req.path.startsWith('/webhooks') ||
    req.path.includes('.')
  ) {
    return next();
  }

  const pathParts = req.path.split('/').filter(Boolean);
  if (pathParts[0] === 'admin') {
    return next();
  }
  let token = '';

  if (pathParts.length === 3 && pathParts[1] === 'pay') {
    token = pathParts[2];
  } else if (pathParts.length === 3 && pathParts[0] === 'pay') {
    token = pathParts[2];
  } else if (pathParts.length === 2 && pathParts[0] === 'pay') {
    token = pathParts[1];
  } else if (pathParts.length === 2 && !['api', 'webhooks', 'assets', 'static', 'src', 'node_modules', 'admin', '__sandbox_gateway_simulator'].includes(pathParts[0])) {
    token = pathParts[1];
  } else if (pathParts.length === 1 && (pathParts[0].startsWith('PAY') || /^PAY[A-Z0-9]+$/i.test(pathParts[0]))) {
    token = pathParts[0];
  }

  // Check query params fallback
  if (!token && typeof req.query.pay === 'string') token = req.query.pay;
  if (!token && typeof req.query.token === 'string') token = req.query.token;

  if (!token) return next();

  // ONLY intercept if a valid payment link actually exists in the database
  const renderedHtml = getBrandedCheckoutHtml(token, req);
  if (!renderedHtml) return next();

  const ua = req.get('user-agent') || '';
  const isSocialCrawler = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|applebot|bingbot|googlebot/i.test(ua);

  // Social scrapers receive customized Open Graph HTML immediately
  if (isSocialCrawler) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderedHtml);
  }

  // Production browsers receive rendered HTML
  if (isProduction) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderedHtml);
  }

  // Local development with Vite: transform so React SPA mounts with custom meta tags
  const vite = (req.app as any).get('viteServer');
  if (vite) {
    try {
      const transformed = await vite.transformIndexHtml(req.originalUrl, renderedHtml);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(transformed);
    } catch (err) {
      console.error('[Preview Handler] Vite transform error:', err);
    }
  }

  next();
};

app.use(socialPreviewHandler);

// Background Data Retention Management
// Prunes audit/webhook logs (60 days), inactive customers (60 days), payment links (90 days)
function runRetentionCycle() {
  try {
    const stats = Database.pruneExpiredData();
    if (stats.prunedAuditLogs > 0 || stats.prunedWebhookLogs > 0 || stats.prunedLinks > 0 || stats.prunedCustomers > 0) {
      console.log(`[Retention] Automated prune: ${stats.prunedAuditLogs} logs, ${stats.prunedLinks} links, ${stats.prunedCustomers} customers`);
    }
  } catch (err) {
    console.error('[Retention] Error during prune cycle:', err);
  }
}

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.set('viteServer', vite);
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Run retention prune on startup and every 6 hours
  runRetentionCycle();
  setInterval(runRetentionCycle, 6 * 3600 * 1000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EaglePay Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[EaglePay Server] Webhook listener mounted at /webhooks/eaglepay`);
    console.log(`[EaglePay Server] Production Cloud (Railway/Render) & Local Dev ready`);
  });
}

startServer();
