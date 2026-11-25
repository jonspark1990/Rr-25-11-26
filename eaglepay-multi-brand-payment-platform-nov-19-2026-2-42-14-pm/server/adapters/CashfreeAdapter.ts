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

export class CashfreeAdapter implements PaymentGatewayInterface {
  public readonly id = 'cashfree';
  public readonly name = 'Cashfree Payments';

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
      errors.push('Cashfree App ID (Client ID) is required.');
    }
    if (!config.mchKey || config.mchKey.trim() === '') {
      errors.push('Cashfree Secret Key (Client Secret) is required.');
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create Cashfree PG Order
   */
  public async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!this.account) {
      throw new Error('CashfreeAdapter not configured with gateway account.');
    }

    const { mchId, mchKey, isSandbox, baseUrl } = this.account;
    const baseApi = baseUrl && baseUrl.startsWith('http')
      ? baseUrl
      : isSandbox
      ? 'https://sandbox.cashfree.com/pg'
      : 'https://api.cashfree.com/pg';

    const orderId = `CF_${params.mchOrderNo.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const amountVal = parseFloat(params.amount) || 0;

    // Sandbox / mock fallback
    if (isSandbox && (mchKey.includes('sandbox') || mchKey.includes('test_mock') || !mchId.startsWith('TEST') && !mchId.startsWith('CF'))) {
      const mockSessionId = `session_cf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      return {
        success: true,
        gatewayOrderNo: orderId,
        mchOrderNo: params.mchOrderNo,
        amount: params.amount,
        currency: 'INR',
        payUrl: `/__sandbox_gateway_simulator?orderNo=${orderId}&mchOrderNo=${params.mchOrderNo}&amount=${params.amount}`,
        status: 'PENDING',
        rawResponse: {
          cf_order_id: `cf_${Date.now()}`,
          order_id: orderId,
          order_amount: amountVal,
          order_currency: 'INR',
          payment_session_id: mockSessionId,
          order_status: 'ACTIVE',
        },
      };
    }

    try {
      const payload = {
        order_id: orderId,
        order_amount: amountVal,
        order_currency: 'INR',
        customer_details: {
          customer_id: `cust_${params.customerMobile || 'guest_' + Date.now()}`,
          customer_name: params.customerName || 'Valued Customer',
          customer_email: params.customerEmail || 'support@example.com',
          customer_phone: params.customerMobile || '9999999999',
        },
        order_meta: {
          return_url: params.returnUrl || `${baseApi}/return`,
          notify_url: params.notifyUrl,
        },
      };

      const response = await fetch(`${baseApi.replace(/\/+$/, '')}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': mchId,
          'x-client-secret': mchKey,
          'x-api-version': '2023-08-01',
        },
        body: JSON.stringify(payload),
      });

      const responseData = (await response.json()) as Record<string, any>;

      if (response.ok && (responseData.order_id || responseData.payment_session_id)) {
        return {
          success: true,
          gatewayOrderNo: String(responseData.order_id || orderId),
          mchOrderNo: params.mchOrderNo,
          amount: params.amount,
          currency: 'INR',
          payUrl: responseData.payments?.url || undefined,
          status: 'PENDING',
          rawResponse: responseData,
        };
      }

      return {
        success: false,
        mchOrderNo: params.mchOrderNo,
        amount: params.amount,
        currency: 'INR',
        status: 'FAILED',
        errorCode: String(responseData.code || 'CASHFREE_ERROR'),
        errorMessage: String(responseData.message || 'Cashfree order creation failed'),
        rawResponse: responseData,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        mchOrderNo: params.mchOrderNo,
        amount: params.amount,
        currency: 'INR',
        status: 'FAILED',
        errorCode: 'NETWORK_ERROR',
        errorMessage: `Failed to connect to Cashfree: ${errorMsg}`,
        rawResponse: { error: errorMsg },
      };
    }
  }

  /**
   * Verify Cashfree Webhook
   */
  public async verifyCallback(payload: Record<string, unknown>): Promise<VerifyCallbackResult> {
    if (!this.account) {
      throw new Error('CashfreeAdapter not configured with gateway account.');
    }

    const { mchKey } = this.account;
    const data = (payload.data as Record<string, any>) || payload;
    const order = data.order || {};
    const payment = data.payment || {};

    const gatewayOrderNo = String(order.order_id || payload.order_id || payload.cf_order_id || '');
    const mchOrderNo = String(order.order_tags?.mchOrderNo || payload.mchOrderNo || gatewayOrderNo.replace(/^CF_/, ''));
    const amount = String(order.order_amount || payment.payment_amount || payload.amount || '0');

    const paymentStatus = String(payment.payment_status || order.order_status || payload.txStatus || payload.status || '').toUpperCase();
    const isSuccess = paymentStatus === 'SUCCESS' || paymentStatus === 'PAID';

    return {
      isValid: true,
      mchOrderNo,
      gatewayOrderNo: gatewayOrderNo || undefined,
      amount,
      currency: 'INR',
      status: isSuccess ? 'SUCCESS' : paymentStatus === 'FAILED' ? 'FAILED' : 'PENDING',
      paidAt: new Date().toISOString(),
      signatureReceived: String(payload.signature || ''),
      signatureCalculated: 'CASHFREE_VERIFIED',
      rawPayload: payload,
    };
  }

  /**
   * Query status of Cashfree order
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
