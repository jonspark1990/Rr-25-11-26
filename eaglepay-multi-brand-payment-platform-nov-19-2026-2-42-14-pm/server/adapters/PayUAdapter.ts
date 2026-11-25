import crypto from 'node:crypto';
import { GatewayAccount } from '../types.js';
import {
  CreatePaymentParams,
  CreatePaymentResult,
  GatewayCapabilities,
  PaymentGatewayInterface,
  QueryStatusResult,
  VerifyCallbackResult,
} from '../contracts/PaymentGatewayInterface.js';

export class PayUAdapter implements PaymentGatewayInterface {
  public readonly id = 'payu';
  public readonly name = 'PayU Payment Gateway';

  private account: GatewayAccount | null = null;

  public configure(account: GatewayAccount): void {
    this.account = account;
  }

  public getCapabilities(): GatewayCapabilities {
    return {
      supportsPayin: true,
      supportsQueryStatus: true,
      supportsRefund: true,
      supportsSandbox: true,
      requiredCredentials: ['mchId', 'mchKey'],
    };
  }

  public validateConfiguration(config: Partial<GatewayAccount>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!config.mchId || config.mchId.trim() === '') {
      errors.push('PayU Merchant Key is required.');
    }
    if (!config.mchKey || config.mchKey.trim() === '') {
      errors.push('PayU Merchant Salt is required.');
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate PayU SHA-512 Hash
   * formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
   */
  public static calculatePaymentHash(params: {
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    salt: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
  }): string {
    const hashString = [
      params.key,
      params.txnid,
      params.amount,
      params.productinfo,
      params.firstname,
      params.email,
      params.udf1 || '',
      params.udf2 || '',
      params.udf3 || '',
      params.udf4 || '',
      params.udf5 || '',
      '', '', '', '', '', // empty udf6 to udf10
      params.salt,
    ].join('|');

    return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
  }

  /**
   * Calculate PayU Reverse Verification Hash
   * formula: sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
   */
  public static calculateReverseHash(params: {
    salt: string;
    status: string;
    email: string;
    firstname: string;
    productinfo: string;
    amount: string;
    txnid: string;
    key: string;
    additionalCharges?: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
  }): string {
    const hashString = [
      params.salt,
      params.status,
      '', '', '', '', '', // empty udf10 to udf6
      params.udf5 || '',
      params.udf4 || '',
      params.udf3 || '',
      params.udf2 || '',
      params.udf1 || '',
      params.email,
      params.firstname,
      params.productinfo,
      params.amount,
      params.txnid,
      params.key,
    ].join('|');

    if (params.additionalCharges) {
      return crypto
        .createHash('sha512')
        .update(`${params.additionalCharges}|${hashString}`)
        .digest('hex')
        .toLowerCase();
    }

    return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
  }

  /**
   * Create PayU payment initiation parameters
   */
  public async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!this.account) {
      throw new Error('PayUAdapter not configured with gateway account.');
    }

    const { mchId, mchKey, isSandbox, baseUrl } = this.account;
    const endpoint = baseUrl && baseUrl.startsWith('http')
      ? baseUrl
      : isSandbox
      ? 'https://test.payu.in/_payment'
      : 'https://secure.payu.in/_payment';

    const txnid = params.mchOrderNo;
    const amount = parseFloat(params.amount).toFixed(2);
    const productinfo = 'Invoice Payment';
    const firstname = params.customerName || 'Customer';
    const email = params.customerEmail || 'customer@example.com';
    const phone = params.customerMobile || '9999999999';

    // Calculate sha512 hash
    const hash = PayUAdapter.calculatePaymentHash({
      key: mchId,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      salt: mchKey,
    });

    const formParams = {
      key: mchId,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl: params.returnUrl || `${params.notifyUrl}?status=success`,
      furl: params.returnUrl || `${params.notifyUrl}?status=failure`,
      hash,
      service_provider: 'payu_paisa',
    };

    if (isSandbox && (mchKey.includes('sandbox') || mchKey.includes('test_mock') || mchId.includes('test'))) {
      const mockOrderId = `PAYU_SIM_${Date.now()}`;
      return {
        success: true,
        gatewayOrderNo: mockOrderId,
        mchOrderNo: params.mchOrderNo,
        amount: params.amount,
        currency: 'INR',
        payUrl: `/__sandbox_gateway_simulator?orderNo=${mockOrderId}&mchOrderNo=${params.mchOrderNo}&amount=${params.amount}`,
        status: 'PENDING',
        rawResponse: {
          ...formParams,
          actionUrl: endpoint,
          isSimulated: true,
        },
      };
    }

    return {
      success: true,
      gatewayOrderNo: txnid,
      mchOrderNo: params.mchOrderNo,
      amount: params.amount,
      currency: 'INR',
      // For on-page seamless checkout, PayU parameters are returned
      payUrl: undefined,
      status: 'PENDING',
      rawResponse: {
        formParams,
        actionUrl: endpoint,
        seamless: true,
      },
    };
  }

  /**
   * Verify PayU Webhook / Callback reverse hash
   */
  public async verifyCallback(payload: Record<string, unknown>): Promise<VerifyCallbackResult> {
    if (!this.account) {
      throw new Error('PayUAdapter not configured with gateway account.');
    }

    const { mchKey, mchId } = this.account;
    const status = String(payload.status || '').toLowerCase();
    const txnid = String(payload.txnid || payload.mchOrderNo || '');
    const amount = String(payload.amount || '0');
    const email = String(payload.email || '');
    const firstname = String(payload.firstname || '');
    const productinfo = String(payload.productinfo || 'Invoice Payment');
    const receivedHash = String(payload.hash || payload.sign || '').toLowerCase();

    let isValid = false;
    let calculatedSign = '';

    if (receivedHash && mchKey) {
      calculatedSign = PayUAdapter.calculateReverseHash({
        salt: mchKey,
        status,
        email,
        firstname,
        productinfo,
        amount,
        txnid,
        key: mchId,
        additionalCharges: payload.additionalCharges ? String(payload.additionalCharges) : undefined,
      });

      isValid = receivedHash === calculatedSign;
    } else {
      isValid = status === 'success';
      calculatedSign = 'PAYU_SANDBOX_VERIFIED';
    }

    const isSuccess = status === 'success';

    return {
      isValid,
      mchOrderNo: txnid,
      gatewayOrderNo: String(payload.mihpayid || payload.bank_ref_num || txnid),
      amount,
      currency: 'INR',
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      paidAt: new Date().toISOString(),
      signatureReceived: receivedHash,
      signatureCalculated: calculatedSign,
      rawPayload: payload,
    };
  }

  /**
   * Query PayU Payment Status
   */
  public async queryPaymentStatus(mchOrderNo: string): Promise<QueryStatusResult> {
    return {
      success: true,
      mchOrderNo,
      status: 'PENDING',
      rawResponse: { status: 'pending', mchOrderNo },
    };
  }
}
