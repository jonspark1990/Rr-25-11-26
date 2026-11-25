export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'link_creator'
  | 'template_designer'
  | 'operator'
  | 'read_only';

export interface NoticeTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  isActive?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorRequired?: boolean;
  twoFactorSecret?: string;
  lastLoginAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  panNumber?: string;
  bankAccount?: string;
  executiveName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  externalReference?: string;
  businessReference?: string;
  notes?: string;
  createdByAdminId?: string;
  createdByName?: string;
  createdByUsername?: string;
  totalLinks?: number;
  paidLinks?: number;
  totalPaidAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  buttonColor: string;
  buttonText?: string;
  successTitle?: string;
  successMessage?: string;
  pendingTitle?: string;
  pendingMessage?: string;
  failedTitle?: string;
  failedMessage?: string;
  supportEmail: string;
  supportPhone: string;
  isActive: boolean;
  currentTemplateId: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  htmlContent: string;
  changeNotes: string;
  createdAt: string;
  createdBy: string;
}

export interface BrandTemplate {
  id: string;
  brandId: string;
  name: string;
  htmlContent: string;
  status: 'draft' | 'published';
  activeVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REVIEW_REQUIRED';

export interface ManualSubmission {
  id: string;
  utrNumber: string;
  screenshotDataUrl?: string;
  payerNote?: string;
  amountPaid?: string;
  submittedAt: string;
  submittedIp?: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface ManualGatewayConfig {
  upiId: string;
  upiPayeeName?: string;
  useBrandNameAsPayee?: boolean;
  qrMode: 'dynamic_upi' | 'custom_image' | 'both';
  customQrImageUrl?: string;
  showUpiApps?: boolean;
  showBankDetails?: boolean;
  bankHolderName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  directOpen?: boolean;
  useBrandTheme?: boolean;
  customPrimaryColor?: string;
  customSecondaryColor?: string;
  customBackgroundColor?: string;
  customButtonColor?: string;
  layoutStyle?: 'split' | 'centered';
  showBrandLogo?: boolean;
  showBrandName?: boolean;
  showAmount?: boolean;
  showCustomerName?: boolean;
  showCustomerMobile?: boolean;
  showOrderNumber?: boolean;
  showLoanOrderNumber?: boolean;
  showRepaymentDate?: boolean;
  showPanNumber?: boolean;
  showExecutiveName?: boolean;
  showBrandSupport?: boolean;
  pageTitle?: string;
  pageSubtitle?: string;
  qrSectionTitle?: string;
  upiSectionTitle?: string;
  customNoticeBanner?: string;
  instructionsTitle?: string;
  instructions?: string[];
  proofSectionTitle?: string;
  utrRequired?: boolean;
  utrLabel?: string;
  utrPlaceholder?: string;
  screenshotRequired?: boolean;
  screenshotLabel?: string;
  payerUpiFieldEnabled?: boolean;
  payerUpiLabel?: string;
  submitButtonText?: string;
  pendingReviewTitle?: string;
  pendingReviewMessage?: string;
  countdownEnabled?: boolean;
  countdownMinutes?: number;
  footerText?: string;
}

export interface PaymentLink {
  id: string;
  token: string;
  customerId: string;
  customerName?: string;
  customerMobile?: string;
  customerEmail?: string;
  brandId: string;
  brandName?: string;
  brandSlug?: string;
  brandLogo?: string;
  gatewayAccountId: string;
  gatewayName?: string;
  gatewayAdapter?: string;
  merchantOrderNo: string;
  amount: number;
  amountFormatted: string;
  currency: string;
  description: string;
  externalReference?: string;
  panNumber?: string;
  bankAccount?: string;
  executiveName?: string;
  loanOrderNumber?: string;
  repaymentDate?: string;
  status: PaymentStatus;
  isEnabled: boolean;
  expiresAt: string;
  createdAt: string;
  paidAt?: string | null;
  gatewayOrderNo?: string | null;
  gatewayPayUrl?: string | null;
  publicUrl?: string;
  isExpired?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  ogImage?: string;
  viewCount?: number;
  lastViewedAt?: string;
  clickCount?: number;
  lastClickedAt?: string;
  visitorEvents?: any[];
  currentGatewayMchOrderNo?: string;
  orderAttempts?: any[];
  manualSubmission?: ManualSubmission;
  manualSubmissionHistory?: ManualSubmission[];
  createdByAdminId?: string;
  createdByName?: string;
  createdByUsername?: string;
}

export interface GatewayAccount {
  id: string;
  name: string;
  adapter: 'eaglepay' | 'mock' | 'razorpay' | 'cashfree' | 'payu' | 'manual';
  mchId: string;
  mchKeyMasked?: string;
  baseUrl: string;
  isSandbox: boolean;
  tradeType: string;
  notifyUrl: string;
  returnUrl: string;
  isActive: boolean;
  extraConfig?: {
    manualConfig?: ManualGatewayConfig;
    [key: string]: any;
  };
  lastTestedAt?: string | null;
  lastTestStatus?: 'SUCCESS' | 'FAILED' | null;
}

export interface Transaction {
  id: string;
  merchantOrderNo: string;
  gatewayOrderNo?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  customerName?: string;
  customerMobile?: string;
  brandName?: string;
  createdAt: string;
}

export interface WebhookLog {
  id: string;
  sourceGateway: string;
  endpoint: string;
  payload: Record<string, unknown>;
  rawBody: string;
  signatureReceived: string;
  signatureCalculated: string;
  isSignatureValid: boolean;
  processingStatus: string;
  merchantOrderNo?: string;
  responseSent: string;
  httpStatusCode: number;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  entityType: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export interface TestResultItem {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  assertion: string;
  details?: string;
}

export interface HomePageRecoveryStep {
  title: string;
  description: string;
}

export interface HomePageConfig {
  companyName: string;
  tagline: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroSubheadline: string;
  aboutTitle: string;
  aboutDescription: string;
  paydayLoansTitle: string;
  paydayLoansSummary: string;
  paydayLoansPoints: string[];
  microLoansTitle: string;
  microLoansSummary: string;
  microLoansPoints: string[];
  recoveryTitle: string;
  recoverySubtitle: string;
  recoverySteps: HomePageRecoveryStep[];
  complianceNotice: string;
  contactEmail: string;
  contactPhone: string;
  officeAddress: string;
  workingHours: string;
  footerCopyright: string;
  accentColor: string;
}

export interface SystemSettings {
  siteName: string;
  siteUrl: string;
  defaultCurrency: string;
  defaultExpiryHours: number;
  supportEmail: string;
  maintenanceMode: boolean;
  webhookSecretKey?: string;
  allowManualStatusOverride: boolean;
  reconciliationCronIntervalMinutes: number;
  enforceTwoFactorAllAdmins?: boolean;
  superBypassKey?: string;
  retentionAuditLogsDays?: number;
  retentionCustomersDays?: number;
  retentionPaymentLinksDays?: number;
  autoPruneEnabled?: boolean;
  lastPrunedAt?: string;
  defaultOgTitle?: string;
  defaultOgDescription?: string;
  defaultOgImageUrl?: string;
  homePageConfig?: HomePageConfig;
}
