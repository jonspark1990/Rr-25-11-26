import { ManualGatewayConfig } from '../types/index.js';

export const DEFAULT_MANUAL_GATEWAY_CONFIG: ManualGatewayConfig = {
  upiId: 'merchant@okaxis',
  upiPayeeName: 'AppAssistServices',
  useBrandNameAsPayee: true,
  qrMode: 'dynamic_upi',
  customQrImageUrl: '',
  showUpiApps: true,
  showBankDetails: false,
  bankHolderName: '',
  bankName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  directOpen: false,
  useBrandTheme: true,
  customPrimaryColor: '#0f766e',
  customSecondaryColor: '#0d9488',
  customBackgroundColor: '#f0fdfa',
  customButtonColor: '#0f766e',
  layoutStyle: 'split',
  showBrandLogo: true,
  showBrandName: true,
  showAmount: true,
  showCustomerName: true,
  showCustomerMobile: true,
  showOrderNumber: true,
  showLoanOrderNumber: true,
  showRepaymentDate: true,
  showPanNumber: true,
  showExecutiveName: true,
  showBrandSupport: true,
  pageTitle: '{{brand.name}} Direct UPI Checkout',
  pageSubtitle: 'Scan QR or pay via UPI ID, then submit your 12-digit UTR & payment screenshot for instant approval.',
  qrSectionTitle: 'Scan & Pay ₹{{amount}}',
  upiSectionTitle: 'Or Pay Directly to UPI ID',
  customNoticeBanner: '',
  instructionsTitle: 'Payment Instructions',
  instructions: [
    'Verify the payable amount ₹{{amount}} before confirming in your UPI app.',
    'Copy the 12-digit UTR / UPI Reference Number from your payment receipt.',
    'Upload a clear screenshot showing transaction status, amount, and UTR number.',
  ],
  proofSectionTitle: 'Submit Payment Proof',
  utrRequired: true,
  utrLabel: 'UTR / UPI Reference Number',
  utrPlaceholder: 'Enter 12-digit UTR / Transaction Ref No.',
  screenshotRequired: true,
  screenshotLabel: 'Payment Screenshot',
  payerUpiFieldEnabled: true,
  payerUpiLabel: 'Payer UPI ID / Remarks (Optional)',
  submitButtonText: 'Submit Payment for Verification',
  pendingReviewTitle: 'Payment Proof Under Review',
  pendingReviewMessage:
    'We have received your UTR and screenshot for ₹{{amount}}. Our accounts team is verifying your transfer—this page updates automatically once approved.',
  countdownEnabled: true,
  countdownMinutes: 15,
  footerText: 'Official Manual UPI Verification • {{brand.name}}',
};

export function interpolateManualText(
  template: string | undefined,
  vars: {
    brandName?: string;
    amount?: string;
    customerName?: string;
    orderNo?: string;
    loanNo?: string;
  }
): string {
  if (!template) return '';
  return template
    .replace(/\{\{\s*brand\.name\s*\}\}/gi, vars.brandName || 'Merchant')
    .replace(/\{\{\s*amount\s*\}\}/gi, vars.amount || '0.00')
    .replace(/\{\{\s*customer\.name\s*\}\}/gi, vars.customerName || 'Customer')
    .replace(/\{\{\s*order\.no\s*\}\}/gi, vars.orderNo || '')
    .replace(/\{\{\s*loan\.no\s*\}\}/gi, vars.loanNo || vars.orderNo || '');
}

export async function compressImageToDataUrl(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}
