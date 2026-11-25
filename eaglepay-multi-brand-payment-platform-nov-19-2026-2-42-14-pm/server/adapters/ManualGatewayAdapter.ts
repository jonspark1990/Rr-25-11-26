import { GatewayAccount } from '../types.js';
import {
  CreatePaymentParams,
  CreatePaymentResult,
  GatewayCapabilities,
  PaymentGatewayInterface,
  QueryStatusResult,
  VerifyCallbackResult,
} from '../contracts/PaymentGatewayInterface.js';

/**
 * Manual UPI / QR Gateway Adapter
 * Handles direct merchant UPI/QR/Bank transfers where customers submit
 * UTR numbers and payment screenshots for admin verification & approval.
 */
export class ManualGatewayAdapter implements PaymentGatewayInterface {
  public readonly id = 'manual';
  public readonly name = 'Manual UPI / QR Gateway';

  private account: GatewayAccount | null = null;

  public configure(account: GatewayAccount): void {
    this.account = account;
  }

  public getCapabilities(): GatewayCapabilities {
    return {
      supportsPayin: true,
      supportsQueryStatus: true,
      supportsRefund: false,
      supportsSandbox: false,
      requiredCredentials: ['upiId'],
    };
  }

  public validateConfiguration(config: Partial<GatewayAccount>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const manualConfig = config.extraConfig?.manualConfig;
    const hasUpi = Boolean(manualConfig?.upiId?.trim());
    const hasCustomQr = Boolean(manualConfig?.customQrImageUrl?.trim());
    const hasBank = Boolean(manualConfig?.showBankDetails && manualConfig?.bankAccountNumber?.trim());

    if (!hasUpi && !hasCustomQr && !hasBank) {
      errors.push('Configure at least a UPI ID, a Custom QR Image, or Bank Transfer details.');
    }

    return { isValid: errors.length === 0, errors };
  }

  public async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const manualOrderNo = `MAN-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const manualConfig = this.account?.extraConfig?.manualConfig;

    return {
      success: true,
      gatewayOrderNo: manualOrderNo,
      mchOrderNo: params.mchOrderNo,
      amount: params.amount,
      currency: 'INR',
      // No external redirect URL; publicCheckout handles manual UI in-place
      payUrl: undefined,
      status: 'PENDING',
      rawResponse: {
        mode: 'manual',
        manualOrderNo,
        mchOrderNo: params.mchOrderNo,
        amount: params.amount,
        upiId: manualConfig?.upiId || this.account?.mchId || '',
        qrMode: manualConfig?.qrMode || 'dynamic_upi',
        status: 'pending_manual_transfer',
      },
    };
  }

  public async verifyCallback(payload: Record<string, unknown>): Promise<VerifyCallbackResult> {
    return {
      isValid: false,
      mchOrderNo: String(payload.mchOrderNo || ''),
      amount: String(payload.amount || '0'),
      currency: 'INR',
      status: 'UNKNOWN',
      signatureReceived: '',
      signatureCalculated: '',
      rawPayload: payload,
      failureReason: 'Manual UPI gateway uses Admin proof verification rather than external webhooks.',
    };
  }

  public async queryPaymentStatus(mchOrderNo: string): Promise<QueryStatusResult> {
    const manualConfig = this.account?.extraConfig?.manualConfig;
    const hasUpi = Boolean(manualConfig?.upiId?.trim());
    const hasCustomQr = Boolean(manualConfig?.customQrImageUrl?.trim());
    const hasBank = Boolean(manualConfig?.showBankDetails && manualConfig?.bankAccountNumber?.trim());

    return {
      success: hasUpi || hasCustomQr || hasBank,
      mchOrderNo,
      gatewayOrderNo: mchOrderNo,
      status: 'PENDING',
      currency: 'INR',
      rawResponse: {
        mode: 'manual',
        configured: hasUpi || hasCustomQr || hasBank,
        upiId: manualConfig?.upiId || this.account?.mchId || '',
        qrMode: manualConfig?.qrMode || 'dynamic_upi',
      },
      errorMessage:
        hasUpi || hasCustomQr || hasBank
          ? undefined
          : 'Manual gateway has no UPI ID, QR Image, or Bank Account configured yet.',
    };
  }
}
