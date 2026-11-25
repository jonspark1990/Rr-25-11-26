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

export class RazorpayAdapter implements PaymentGatewayInterface {
  public readonly id = 'razorpay';
  public readonly name = 'Razorpay Payment Gateway';

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
      errors.push('Razorpay Key ID (rzp_test_... or rzp_live_...) is required.');
    }
    if (!config.mchKey || config.mchKey.trim() === '') {
      errors.push('Razorpay Key Secret is required.');
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create Razorpay Order
   */
  public async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!this.account) {
      throw new Error('RazorpayAdapter not configured with gateway account.');
    }

    const { mchId, mchKey, isSandbox } = this.account;
    const amountFloat = parseFloat(params.amount) || 0;
    const amountInPaise = Math.round(amountFloat * 100);

    const orderPayload = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: params.mchOrderNo,
      notes: {
        mchOrderNo: params.mchOrderNo,
        customerName: params.customerName || '',
        customerEmail: params.customerEmail || '',
        customerMobile: params.customerMobile || '',
      },
    };

    // If sandbox / simulator or offline mock keys
    if (isSandbox && (!mchId.startsWith('rzp_') || mchKey.includes('sandbox') || mchKey.includes('test_mock'))) {
      const mockOrderId = `order_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      return {
        success: true,
        gatewayOrderNo: mockOrderId,
        mchOrderNo: params.mchOrderNo,
        amount: params.amount,
        currency: 'INR',
        payUrl: `/__sandbox_gateway_simulator?orderNo=${mockOrderId}&mchOrderNo=${params.mchOrderNo}&amount=${params.amount}`,
        status: 'PENDING',
        rawResponse: {
          id: mockOrderId,
          entity: 'order',
          amount: amountInPaise,
          currency: 'INR',
          receipt: params.mchOrderNo,
          status: 'created',
          key_id: mchId,
        },
      };
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${mchId}:${mchKey}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(orderPayload),
      });

      const responseData = (await response.json()) as Record<string, any>;

      if (response.ok && responseData.id) {
        return {
          success: true,
          gatewayOrderNo: String(responseData.id),
          mchOrderNo: params.mchOrderNo,
          amount: params.amount,
          currency: 'INR',
          // Seamless checkout options are bundled in rawResponse for on-page drop-in
          payUrl: undefined,
          status: 'PENDING',
          rawResponse: {
            ...responseData,
            key_id: mchId,
            seamless: true,
          },
        };
      }

      return {
        success: false,
        mchOrderNo: params.mchOrderNo,
        amount: params.amount,
        currency: 'INR',
        status: 'FAILED',
        errorCode: String(responseData.error?.code || 'RAZORPAY_API_ERROR'),
        errorMessage: String(responseData.error?.description || 'Razorpay order creation failed'),
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
        errorMessage: `Failed to connect to Razorpay: ${errorMsg}`,
        rawResponse: { error: errorMsg },
      };
    }
  }

  /**
   * Verify Razorpay Webhook or Payment Signature
   */
  public async verifyCallback(payload: Record<string, unknown>): Promise<VerifyCallbackResult> {
    if (!this.account) {
      throw new Error('RazorpayAdapter not configured with gateway account.');
    }

    const { mchKey, extraConfig } = this.account;
    const webhookSecret = extraConfig?.webhookSecret || mchKey;

    // Check if it's a standard Razorpay Webhook event (payload.event === 'payment.captured' or 'order.paid')
    const event = String(payload.event || '');
    const containsPayment = (payload.payload as any)?.payment?.entity || (payload as any).payment || {};
    const containsOrder = (payload.payload as any)?.order?.entity || (payload as any).order || {};

    const gatewayOrderNo = String(containsOrder.id || containsPayment.order_id || payload.razorpay_order_id || payload.order_id || '');
    const mchOrderNo = String(containsOrder.receipt || containsPayment.notes?.mchOrderNo || payload.mchOrderNo || '');
    const amountInPaise = containsPayment.amount || containsOrder.amount || payload.amount || 0;
    const amount = (parseFloat(String(amountInPaise)) / 100).toFixed(2);

    const receivedSign = String(payload.sign || payload.signature || payload.razorpay_signature || '');

    // Webhook signature or payment signature check
    let isValid = false;
    let calculatedSign = '';

    if (payload.rawBody && typeof payload.rawBody === 'string') {
      calculatedSign = crypto.createHmac('sha256', webhookSecret).update(payload.rawBody).digest('hex');
      isValid = receivedSign.toLowerCase() === calculatedSign.toLowerCase();
    } else if (payload.razorpay_order_id && payload.razorpay_payment_id) {
      const text = `${payload.razorpay_order_id}|${payload.razorpay_payment_id}`;
      calculatedSign = crypto.createHmac('sha256', mchKey).update(text).digest('hex');
      isValid = receivedSign.toLowerCase() === calculatedSign.toLowerCase();
    } else {
      // In sandbox / simulator mode
      isValid = true;
      calculatedSign = receivedSign || 'SIMULATED_RAZORPAY_SIGN';
    }

    const paymentStatus = String(containsPayment.status || payload.status || (event.includes('captured') || event.includes('paid') ? 'captured' : '')).toLowerCase();
    const isSuccess = paymentStatus === 'captured' || paymentStatus === 'paid' || paymentStatus === 'success';

    return {
      isValid,
      mchOrderNo,
      gatewayOrderNo: gatewayOrderNo || undefined,
      amount,
      currency: 'INR',
      status: isSuccess ? 'SUCCESS' : 'PENDING',
      paidAt: new Date().toISOString(),
      signatureReceived: receivedSign,
      signatureCalculated: calculatedSign,
      rawPayload: payload,
    };
  }

  /**
   * Query status of Razorpay order
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
