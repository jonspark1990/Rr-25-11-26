import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware.js';
import { Database, DEFAULT_MANUAL_GATEWAY_CONFIG } from '../db/database.js';
import { GatewayAccount } from '../types.js';
import { GatewayFactory } from '../adapters/GatewayFactory.js';

export const gatewayRouter = Router();

function maskSecret(secret: string): string {
  if (!secret || secret.length < 6) return '••••••••';
  return secret.slice(0, 3) + '••••••••' + secret.slice(-3);
}

// GET /api/gateway-accounts
gatewayRouter.get('/', requireAuth('read_only'), (req: AuthenticatedRequest, res: Response): void => {
  const accounts = Database.getGatewayAccounts();
  const safeAccounts = accounts.map((a) => ({
    ...a,
    mchKeyMasked: maskSecret(a.mchKey),
    mchKey: undefined, // Never expose raw key in list
  }));

  res.json({ success: true, accounts: safeAccounts });
});

// POST /api/gateway-accounts
gatewayRouter.post('/', requireAuth('super_admin'), (req: AuthenticatedRequest, res: Response): void => {
  const { name, adapter, mchId, mchKey, baseUrl, isSandbox, tradeType, notifyUrl, returnUrl, extraConfig } = req.body;
  const validAdapter = (adapter || 'eaglepay') as GatewayAccount['adapter'];

  if (validAdapter === 'manual') {
    if (!name || !String(name).trim()) {
      res.status(400).json({ success: false, error: 'Account Display Name is required.' });
      return;
    }

    const incomingManual = extraConfig?.manualConfig || {};
    const mergedManual = {
      ...DEFAULT_MANUAL_GATEWAY_CONFIG,
      ...incomingManual,
    };

    const hasDestination =
      Boolean(mergedManual.upiId?.trim()) ||
      Boolean(mergedManual.customQrImageUrl?.trim()) ||
      Boolean(mergedManual.showBankDetails && mergedManual.bankAccountNumber?.trim());

    if (!hasDestination) {
      res.status(400).json({
        success: false,
        error: 'Manual gateway requires a UPI ID, a Custom QR image, or Bank Transfer details.',
      });
      return;
    }

    const newAccount: GatewayAccount = {
      id: 'gw_' + crypto.randomBytes(6).toString('hex'),
      name: String(name).trim(),
      adapter: 'manual',
      mchId: mergedManual.upiId?.trim() || mchId?.trim() || 'MANUAL_UPI',
      mchKey: 'MANUAL_MODE_NO_SECRET',
      baseUrl: 'manual://upi-direct',
      isSandbox: false,
      tradeType: 'MANUAL_UPI',
      notifyUrl: 'manual://internal-review',
      returnUrl: 'manual://internal-status',
      isActive: true,
      extraConfig: {
        ...(extraConfig || {}),
        manualConfig: mergedManual,
      },
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: 'SUCCESS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const accounts = Database.getGatewayAccounts();
    accounts.push(newAccount);
    Database.saveGatewayAccounts(accounts);

    Database.appendAuditLog({
      adminId: req.adminUser!.id,
      adminUsername: req.adminUser!.username,
      action: 'GATEWAY_ACCOUNT_CREATED',
      entityType: 'GATEWAY',
      entityId: newAccount.id,
      details: `Added manual UPI/QR gateway "${newAccount.name}" (UPI: ${mergedManual.upiId || 'Custom QR'})`,
    });

    res.status(201).json({
      success: true,
      account: { ...newAccount, mchKeyMasked: maskSecret(newAccount.mchKey), mchKey: undefined },
    });
    return;
  }

  if (!name || !mchId || !mchKey) {
    res.status(400).json({ success: false, error: 'Name, Merchant ID/Key ID, and Secret Key are required.' });
    return;
  }

  const newAccount: GatewayAccount = {
    id: 'gw_' + crypto.randomBytes(6).toString('hex'),
    name: name.trim(),
    adapter: validAdapter,
    mchId: mchId.trim(),
    mchKey: mchKey.trim(),
    baseUrl:
      baseUrl?.trim() ||
      (validAdapter === 'razorpay'
        ? 'https://api.razorpay.com/v1'
        : validAdapter === 'cashfree'
        ? 'https://api.cashfree.com/pg'
        : validAdapter === 'payu'
        ? 'https://secure.payu.in'
        : 'https://xgxbscfgfhtiizzxipog.supabase.co/functions/v1'),
    isSandbox: Boolean(isSandbox),
    tradeType: tradeType?.trim() || 'INRUPI',
    notifyUrl: notifyUrl?.trim() || `https://example.com/webhooks/${validAdapter}`,
    returnUrl: returnUrl?.trim() || 'https://example.com/status',
    isActive: true,
    lastTestedAt: null,
    lastTestStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extraConfig: extraConfig || {},
  };

  const accounts = Database.getGatewayAccounts();
  accounts.push(newAccount);
  Database.saveGatewayAccounts(accounts);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'GATEWAY_ACCOUNT_CREATED',
    entityType: 'GATEWAY',
    entityId: newAccount.id,
    details: `Added gateway account "${newAccount.name}" (${newAccount.adapter})`,
  });

  res.status(201).json({
    success: true,
    account: { ...newAccount, mchKeyMasked: maskSecret(newAccount.mchKey), mchKey: undefined },
  });
});

// PUT /api/gateway-accounts/:id
gatewayRouter.put('/:id', requireAuth('super_admin'), (req: AuthenticatedRequest, res: Response): void => {
  const { name, mchId, mchKey, baseUrl, isSandbox, tradeType, notifyUrl, returnUrl, isActive, extraConfig } = req.body;
  const accounts = Database.getGatewayAccounts();
  const account = accounts.find((a) => a.id === req.params.id);

  if (!account) {
    res.status(404).json({ success: false, error: 'Gateway account not found.' });
    return;
  }

  if (name) account.name = String(name).trim();
  if (mchId) account.mchId = String(mchId).trim();
  // Only update secret key if provided and not masked
  if (mchKey && !String(mchKey).includes('••••')) {
    account.mchKey = String(mchKey).trim();
  }
  if (baseUrl) account.baseUrl = String(baseUrl).trim();
  if (isSandbox !== undefined) account.isSandbox = Boolean(isSandbox);
  if (tradeType) account.tradeType = String(tradeType).trim();
  if (notifyUrl) account.notifyUrl = String(notifyUrl).trim();
  if (returnUrl) account.returnUrl = String(returnUrl).trim();
  if (isActive !== undefined) account.isActive = Boolean(isActive);

  if (extraConfig && typeof extraConfig === 'object') {
    const prevExtra = account.extraConfig || {};
    if (account.adapter === 'manual' && extraConfig.manualConfig) {
      const mergedManual = {
        ...DEFAULT_MANUAL_GATEWAY_CONFIG,
        ...(prevExtra.manualConfig || {}),
        ...extraConfig.manualConfig,
      };
      account.extraConfig = {
        ...prevExtra,
        ...extraConfig,
        manualConfig: mergedManual,
      };
      if (mergedManual.upiId?.trim()) {
        account.mchId = mergedManual.upiId.trim();
      }
    } else {
      account.extraConfig = {
        ...prevExtra,
        ...extraConfig,
      };
    }
  }

  account.updatedAt = new Date().toISOString();

  Database.saveGatewayAccounts(accounts);

  Database.appendAuditLog({
    adminId: req.adminUser!.id,
    adminUsername: req.adminUser!.username,
    action: 'GATEWAY_ACCOUNT_UPDATED',
    entityType: 'GATEWAY',
    entityId: account.id,
    details: `Updated gateway account settings for "${account.name}"`,
  });

  res.json({
    success: true,
    account: { ...account, mchKeyMasked: maskSecret(account.mchKey), mchKey: undefined },
  });
});

// POST /api/gateway-accounts/:id/test
gatewayRouter.post('/:id/test', requireAuth('admin'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const accounts = Database.getGatewayAccounts();
  const account = accounts.find((a) => a.id === req.params.id);
  if (!account) {
    res.status(404).json({ success: false, error: 'Gateway account not found.' });
    return;
  }

  try {
    const adapter = GatewayFactory.create(account);

    if (account.adapter === 'manual') {
      const validation = adapter.validateConfiguration(account);
      account.lastTestedAt = new Date().toISOString();
      account.lastTestStatus = validation.isValid ? 'SUCCESS' : 'FAILED';
      Database.saveGatewayAccounts(accounts);

      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: validation.errors.join(' '),
        });
        return;
      }

      res.json({
        success: true,
        message: 'Manual UPI / QR payment page & proof verification gateway is configured and ready.',
        details: { upiId: account.extraConfig?.manualConfig?.upiId, qrMode: account.extraConfig?.manualConfig?.qrMode },
      });
      return;
    }

    const testResult = await adapter.queryPaymentStatus('TEST_PROBE_CONN_' + Date.now());

    account.lastTestedAt = new Date().toISOString();
    // In live or sandbox, if endpoint responded without network error, consider reachable
    account.lastTestStatus = 'SUCCESS';
    Database.saveGatewayAccounts(accounts);

    res.json({
      success: true,
      message: account.isSandbox
        ? 'Sandbox simulator connection verified.'
        : 'Gateway API responded successfully.',
      details: testResult,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    account.lastTestedAt = new Date().toISOString();
    account.lastTestStatus = 'FAILED';
    Database.saveGatewayAccounts(accounts);

    res.status(500).json({
      success: false,
      error: `Gateway test failed: ${msg}`,
    });
  }
});
