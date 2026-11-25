import fs from 'node:fs';
import path from 'path';
import crypto from 'node:crypto';
import {
  AdminUser,
  AuditLog,
  Brand,
  BrandTemplate,
  Customer,
  GatewayAccount,
  HomePageConfig,
  ManualGatewayConfig,
  NoticeTemplate,
  PaymentLink,
  PaymentStatusHistory,
  SystemSettings,
  TemplateVersion,
  Transaction,
  WebhookLog,
} from '../types.js';
import { NoticeEngine } from '../services/NoticeEngine.js';

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

export const DEFAULT_HOME_PAGE_CONFIG: HomePageConfig = {
  companyName: 'AppAssistServices',
  tagline: 'Ethical Loan Recovery & Borrower Resolution Advisory',
  heroEyebrow: 'CREDIT RESOLUTION & BORROWER EDUCATION',
  heroHeadline: 'Fair, Transparent Loan Recovery & Financial Guidance',
  heroSubheadline:
    'We partner with lending institutions and borrowers to resolve overdue accounts respectfully—providing clear repayment pathways and practical education on Payday Loans and Micro Loans.',
  aboutTitle: 'About Our Recovery Practice',
  aboutDescription:
    'AppAssistServices is an independent loan recovery and receivables advisory firm dedicated to structured, dignity-first resolution. Rather than automated pressure, our case specialists help borrowers understand loan obligations, avoid compounding late fees, and close overdue accounts with documented clarity.',
  paydayLoansTitle: 'Understanding Payday Loans',
  paydayLoansSummary:
    'Payday loans are short-term, unsecured cash advances designed to bridge urgent expenses until a borrower’s next salary cycle. Knowing the true cost and repayment window prevents rollover debt.',
  paydayLoansPoints: [
    'Short tenure: Typically due in full on your next salary date (7 to 45 days).',
    'Higher effective APR: Convenience fees and daily penal charges add up rapidly if overdue.',
    'Single-cycle purpose: Best reserved for genuine emergencies rather than recurring monthly bills.',
    'Early resolution matters: Contacting your recovery desk early helps waive penalties and protect your credit bureau record.',
  ],
  microLoansTitle: 'Understanding Micro Loans',
  microLoansSummary:
    'Micro loans provide small-ticket credit—often between ₹2,000 and ₹1,00,000—for individuals, gig workers, and small shopkeepers who need accessible working capital or personal support.',
  microLoansPoints: [
    'Flexible EMIs: Structured in weekly, bi-weekly, or monthly installments tailored to cash flow.',
    'Minimal collateral: Approved primarily on KYC, income consistency, and repayment track record.',
    'Credit-building impact: Timely closure boosts creditworthiness and unlocks lower-cost formal credit.',
    'Restructuring options: Genuine hardship cases can request revised schedules or One-Time Settlement (OTS) terms.',
  ],
  recoveryTitle: 'How Our Loan Recovery Process Works',
  recoverySubtitle:
    'Every overdue account is handled through a documented, RBI-aligned communication and resolution framework.',
  recoverySteps: [
    {
      title: '1. Account Review & Clear Notice',
      description:
        'We verify principal, accrued interest, and valid waivers with the lending partner before issuing a clear statement of dues.',
    },
    {
      title: '2. Consultative Resolution Options',
      description:
        'Assigned recovery coordinators work with borrowers to arrange full closure, partial extensions, or approved settlement schedules.',
    },
    {
      title: '3. Instant Closure & NOC Records',
      description:
        'Once resolved, account status updates are logged promptly so borrowers receive closure confirmation and credit bureau updates.',
    },
  ],
  complianceNotice:
    'Compliance Commitment: AppAssistServices strictly follows fair debt collection practices. We never endorse harassment, unauthorized contact with third parties, or hidden charges. Always verify official notices through our listed support desk.',
  contactEmail: 'support@appassistservices.com',
  contactPhone: '+91 1800-120-4480',
  officeAddress: 'Suite 402, Trade Tower B, Financial District, Mumbai 400051',
  workingHours: 'Monday – Saturday, 9:30 AM – 6:30 PM IST',
  footerCopyright: '© 2026 AppAssistServices. All rights reserved.',
  accentColor: '#0f766e',
};

interface DatabaseSchema {
  admins: AdminUser[];
  customers: Customer[];
  brands: Brand[];
  templates: BrandTemplate[];
  templateVersions: TemplateVersion[];
  paymentLinks: PaymentLink[];
  gatewayAccounts: GatewayAccount[];
  transactions: Transaction[];
  paymentStatusHistory: PaymentStatusHistory[];
  webhookLogs: WebhookLog[];
  auditLogs: AuditLog[];
  noticeTemplates: NoticeTemplate[];
  systemSettings: SystemSettings;
  meta: {
    version: number;
    lastMigratedAt: string;
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'app_database.json');

export class Database {
  private static data: DatabaseSchema;
  private static isInitialized = false;

  public static initialize(): void {
    if (this.isInitialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
        let needsPersist = false;
        if (!this.data.noticeTemplates || this.data.noticeTemplates.length === 0) {
          this.data.noticeTemplates = NoticeEngine.DEFAULT_TEMPLATES.map((t) => ({
            ...t,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
          needsPersist = true;
        }
        if (!this.data.systemSettings) {
          this.data.systemSettings = {} as SystemSettings;
          needsPersist = true;
        }
        if (!this.data.systemSettings.homePageConfig) {
          this.data.systemSettings.homePageConfig = { ...DEFAULT_HOME_PAGE_CONFIG };
          needsPersist = true;
        }
        if (!Array.isArray(this.data.gatewayAccounts)) {
          this.data.gatewayAccounts = [];
          needsPersist = true;
        }
        const hasManualGw = this.data.gatewayAccounts.some((g) => g.adapter === 'manual');
        if (!hasManualGw) {
          this.data.gatewayAccounts.push({
            id: 'gw_manual_upi_01',
            name: 'Manual UPI / QR Gateway',
            adapter: 'manual',
            mchId: DEFAULT_MANUAL_GATEWAY_CONFIG.upiId,
            mchKey: 'MANUAL_MODE_NO_SECRET',
            baseUrl: 'manual://upi-direct',
            isSandbox: false,
            tradeType: 'MANUAL_UPI',
            notifyUrl: 'manual://internal-review',
            returnUrl: 'manual://internal-status',
            isActive: true,
            extraConfig: {
              manualConfig: { ...DEFAULT_MANUAL_GATEWAY_CONFIG },
            },
            lastTestedAt: new Date().toISOString(),
            lastTestStatus: 'SUCCESS',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          needsPersist = true;
        } else {
          this.data.gatewayAccounts.forEach((g) => {
            if (g.adapter === 'manual') {
              const merged = {
                ...DEFAULT_MANUAL_GATEWAY_CONFIG,
                ...(g.extraConfig?.manualConfig || {}),
              };
              if (!g.extraConfig || !g.extraConfig.manualConfig) {
                g.extraConfig = { ...(g.extraConfig || {}), manualConfig: merged };
                needsPersist = true;
              }
            }
          });
        }
        if (needsPersist) {
          this.persist();
        }
        this.isInitialized = true;
        return;
      } catch (e) {
        console.error('Failed to parse existing DB file, creating fresh initial state:', e);
      }
    }

    this.data = this.createInitialData();
    this.persist();
    this.isInitialized = true;
  }

  public static persist(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Database persist error:', err);
    }
  }

  private static createInitialData(): DatabaseSchema {
    // Generate secure password hash for default admin
    // Password: "Admin@Password2026!"
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.pbkdf2Sync('Admin@Password2026!', salt, 10000, 64, 'sha512').toString('hex');

    const adminId = 'adm_' + crypto.randomBytes(6).toString('hex');
    const samvitBrandId = 'brd_samvit_01';
    const apexBrandId = 'brd_apex_02';

    const defaultHtmlTemplate = `
<div class="checkout-card max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
  <div class="brand-header p-6 text-white text-center" style="background-color: {{brand.primary_color}}">
    <div class="brand-logo text-2xl font-bold tracking-tight mb-1 flex items-center justify-center gap-2">
      <span>{{brand.name}}</span>
    </div>
    <p class="text-xs opacity-80 uppercase tracking-widest font-medium">Secure Payment Gateway</p>
  </div>

  <div class="p-6 space-y-6">
    <div class="text-center pb-4 border-b border-slate-100">
      <span class="text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount to Pay</span>
      <div class="text-4xl font-extrabold text-slate-900 mt-1">₹{{payment.amount}}</div>
      <div class="text-xs text-slate-500 mt-1">Ref: <span class="font-mono font-medium">{{payment.order_number}}</span></div>
    </div>

    <div class="bg-slate-50 rounded-xl p-4 text-xs space-y-2 border border-slate-100">
      <div class="flex justify-between text-slate-600">
        <span>Billed To:</span>
        <span class="font-medium text-slate-900">{{customer.name}}</span>
      </div>
      <div class="flex justify-between text-slate-600">
        <span>Mobile:</span>
        <span class="font-medium text-slate-900">{{customer.mobile}}</span>
      </div>
      <div class="flex justify-between text-slate-600">
        <span>Valid Until:</span>
        <span class="font-medium text-slate-900">{{payment.expires_at}}</span>
      </div>
    </div>

    <div class="text-center text-xs text-slate-400">
      Protected with 256-bit encrypted checkout. Support: {{brand.support_email}}
    </div>
  </div>
</div>
`.trim();

    const template1Id = 'tpl_samvit_01';
    const templateVersion1Id = 'tpl_ver_01';

    const gwEagleProdId = 'gw_eagle_prod';
    const gwEagleSandboxId = 'gw_eagle_sandbox';

    return {
      meta: {
        version: 1,
        lastMigratedAt: new Date().toISOString(),
      },
      admins: [
        {
          id: adminId,
          username: 'admin',
          email: 'admin@platform.local',
          passwordHash,
          salt,
          name: 'Platform Super Administrator',
          role: 'super_admin',
          isActive: true,
          twoFactorEnabled: false,
          lastLoginAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      customers: [
        {
          id: 'cust_01',
          fullName: 'Rajesh Sharma',
          mobile: '9876543210',
          email: 'rajesh.sharma@example.com',
          externalReference: 'CR-10492',
          businessReference: 'VIP-CLIENT',
          notes: 'Regular enterprise subscriber',
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: 'cust_02',
          fullName: 'Priya Sundaram',
          mobile: '9811223344',
          email: 'priya.sundaram@example.com',
          externalReference: 'INV-88210',
          businessReference: 'RETAIL',
          notes: 'Quarterly membership',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
        {
          id: 'cust_03',
          fullName: 'Ananya Verma',
          mobile: '9920334455',
          email: 'ananya.verma@example.com',
          externalReference: 'CORP-5501',
          businessReference: 'ANNUAL-LICENSE',
          notes: 'Software integration fee',
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
      ],
      brands: [
        {
          id: samvitBrandId,
          name: 'Samvit',
          slug: 'samvit',
          logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160&auto=format&fit=crop&q=80',
          primaryColor: '#0f766e',
          secondaryColor: '#0d9488',
          backgroundColor: '#f0fdfa',
          buttonColor: '#0f766e',
          supportEmail: 'support@samvit.com',
          supportPhone: '+91 800-444-2200',
          isActive: true,
          currentTemplateId: template1Id,
          ogTitle: '{{brandName}} - Secure Payment Request ({{amount}})',
          ogDescription: 'Official payment link for {{customerName}} • Ref: #{{orderNo}}. Click to pay {{amount}} securely.',
          ogImageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: apexBrandId,
          name: 'Apex Financial',
          slug: 'apex',
          logoUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=160&auto=format&fit=crop&q=80',
          primaryColor: '#1e3a8a',
          secondaryColor: '#2563eb',
          backgroundColor: '#f8fafc',
          buttonColor: '#1e3a8a',
          supportEmail: 'billing@apexfinancial.com',
          supportPhone: '+91 800-555-1100',
          isActive: true,
          currentTemplateId: template1Id,
          ogTitle: '{{brandName}} - Settlement Clearance ({{amount}})',
          ogDescription: 'Instant payment verification for {{customerName}} (Loan Ref: #{{orderNo}}). Encrypted checkout.',
          ogImageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      templates: [
        {
          id: template1Id,
          brandId: samvitBrandId,
          name: 'Classic Branded Checkout v1',
          htmlContent: defaultHtmlTemplate,
          status: 'published',
          activeVersionId: templateVersion1Id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      templateVersions: [
        {
          id: templateVersion1Id,
          templateId: template1Id,
          versionNumber: 1,
          htmlContent: defaultHtmlTemplate,
          changeNotes: 'Initial production template',
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        },
      ],
      gatewayAccounts: [
        {
          id: gwEagleProdId,
          name: 'Eagle Pay Production Gateway',
          adapter: 'eaglepay',
          mchId: 'MCH_EAGLE_LIVE_882',
          mchKey: 'MCH_KEY_PROD_84F9A321E5C',
          baseUrl: 'https://xgxbscfgfhtiizzxipog.supabase.co/functions/v1',
          isSandbox: false,
          tradeType: 'INRUPI',
          notifyUrl: 'https://example.com/webhooks/eaglepay',
          returnUrl: 'https://example.com/status',
          isActive: true,
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: 'SUCCESS',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: gwEagleSandboxId,
          name: 'Eagle Pay Sandbox Simulator',
          adapter: 'mock',
          mchId: 'MCH_EAGLE_SANDBOX_001',
          mchKey: 'MCH_SANDBOX_SECRET_KEY_99',
          baseUrl: 'https://xgxbscfgfhtiizzxipog.supabase.co/functions/v1',
          isSandbox: true,
          tradeType: 'INRUPI',
          notifyUrl: 'https://example.com/webhooks/eaglepay',
          returnUrl: 'https://example.com/status',
          isActive: true,
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: 'SUCCESS',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'gw_manual_upi_01',
          name: 'Manual UPI / QR Gateway',
          adapter: 'manual',
          mchId: DEFAULT_MANUAL_GATEWAY_CONFIG.upiId,
          mchKey: 'MANUAL_MODE_NO_SECRET',
          baseUrl: 'manual://upi-direct',
          isSandbox: false,
          tradeType: 'MANUAL_UPI',
          notifyUrl: 'manual://internal-review',
          returnUrl: 'manual://internal-status',
          isActive: true,
          extraConfig: {
            manualConfig: { ...DEFAULT_MANUAL_GATEWAY_CONFIG },
          },
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: 'SUCCESS',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      paymentLinks: [
        {
          id: 'plink_01',
          token: 'PAY8F72K9',
          customerId: 'cust_01',
          brandId: samvitBrandId,
          gatewayAccountId: gwEagleSandboxId,
          templateVersionId: templateVersion1Id,
          merchantOrderNo: 'ORD-171800101-SAMVIT',
          amount: 2499.0,
          amountFormatted: '2499.00',
          currency: 'INR',
          description: 'Annual Cloud Suite Subscription',
          externalReference: 'INV-2026-091',
          status: 'CREATED',
          isEnabled: true,
          expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(),
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          createdByAdminId: adminId,
        },
        {
          id: 'plink_02',
          token: 'PAY4B21X8',
          customerId: 'cust_02',
          brandId: apexBrandId,
          gatewayAccountId: gwEagleSandboxId,
          templateVersionId: templateVersion1Id,
          merchantOrderNo: 'ORD-171800102-APEX',
          amount: 500.0,
          amountFormatted: '500.00',
          currency: 'INR',
          description: 'Advisory Consultation Retainer',
          externalReference: 'REF-88912',
          status: 'SUCCESS',
          isEnabled: true,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 82000000).toISOString(),
          paidAt: new Date(Date.now() - 82000000).toISOString(),
          gatewayOrderNo: 'PI1791568498711',
          createdByAdminId: adminId,
        },
      ],
      transactions: [
        {
          id: 'tx_01',
          paymentLinkId: 'plink_02',
          merchantOrderNo: 'ORD-171800102-APEX',
          gatewayOrderNo: 'PI1791568498711',
          amount: 500.0,
          currency: 'INR',
          status: 'SUCCESS',
          callbackReceivedAt: new Date(Date.now() - 82000000).toISOString(),
          createdAt: new Date(Date.now() - 82000000).toISOString(),
        },
      ],
      paymentStatusHistory: [
        {
          id: 'psh_01',
          paymentLinkId: 'plink_01',
          previousStatus: 'CREATED',
          newStatus: 'CREATED',
          source: 'INITIAL',
          reason: 'Payment link generated',
          actor: 'admin',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'psh_02',
          paymentLinkId: 'plink_02',
          previousStatus: 'CREATED',
          newStatus: 'SUCCESS',
          source: 'WEBHOOK',
          reason: 'Verified callback signature matched',
          actor: 'Eagle Pay Gateway',
          createdAt: new Date(Date.now() - 82000000).toISOString(),
        },
      ],
      webhookLogs: [
        {
          id: 'wh_log_01',
          sourceGateway: 'eaglepay',
          endpoint: '/webhooks/eaglepay',
          payload: {
            mchId: 'MCH_EAGLE_SANDBOX_001',
            orderNo: 'PI1791568498711',
            mchOrderNo: 'ORD-171800102-APEX',
            amount: '500.00',
            status: 'success',
            currency: 'INR',
            paidAt: new Date(Date.now() - 82000000).toISOString(),
            sign: 'A7F8B2C4E6D01234567890ABCDEF1234',
          },
          rawBody: '{"mchId":"MCH_EAGLE_SANDBOX_001","orderNo":"PI1791568498711",...}',
          signatureReceived: 'A7F8B2C4E6D01234567890ABCDEF1234',
          signatureCalculated: 'A7F8B2C4E6D01234567890ABCDEF1234',
          isSignatureValid: true,
          processingStatus: 'SUCCESS',
          merchantOrderNo: 'ORD-171800102-APEX',
          responseSent: 'success',
          httpStatusCode: 200,
          createdAt: new Date(Date.now() - 82000000).toISOString(),
        },
      ],
      auditLogs: [
        {
          id: 'audit_01',
          adminId: adminId,
          adminUsername: 'admin',
          action: 'SYSTEM_INITIALIZATION',
          entityType: 'SYSTEM',
          details: 'Initialized database schema, default administrator, and brand profiles',
          ipAddress: '127.0.0.1',
          createdAt: new Date().toISOString(),
        },
      ],
      systemSettings: {
        siteName: 'AppAssistServices',
        siteUrl: 'https://ais-dev-z56ha7zbb6l6tavlozzn5w-619527651196.asia-southeast1.run.app',
        defaultCurrency: 'INR',
        defaultExpiryHours: 72,
        supportEmail: 'dsjexhange.in@gmail.com',
        maintenanceMode: false,
        allowManualStatusOverride: true,
        reconciliationCronIntervalMinutes: 15,
        enforceTwoFactorAllAdmins: false,
        superBypassKey: 'EAGLE-SUPER-MASTER-9988',
        retentionAuditLogsDays: 60,
        retentionCustomersDays: 60,
        retentionPaymentLinksDays: 90,
        autoPruneEnabled: true,
        lastPrunedAt: new Date().toISOString(),
        defaultOgTitle: '{{brandName}} - Secure Payment Request ({{amount}})',
        defaultOgDescription: 'Official payment link for {{customerName}} (Order #{{orderNo}}). Verified merchant gateway.',
        defaultOgImageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
        homePageConfig: { ...DEFAULT_HOME_PAGE_CONFIG },
      },
      noticeTemplates: NoticeEngine.DEFAULT_TEMPLATES.map((t) => ({
        ...t,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    };
  }

  // Repository getters
  public static getNoticeTemplates(): NoticeTemplate[] {
    this.initialize();
    return this.data.noticeTemplates || [];
  }

  public static getAdmins(): AdminUser[] {
    this.initialize();
    return this.data.admins;
  }

  public static getCustomers(): Customer[] {
    this.initialize();
    return this.data.customers;
  }

  public static getBrands(): Brand[] {
    this.initialize();
    return this.data.brands;
  }

  public static getTemplates(): BrandTemplate[] {
    this.initialize();
    return this.data.templates;
  }

  public static getTemplateVersions(): TemplateVersion[] {
    this.initialize();
    return this.data.templateVersions;
  }

  public static getPaymentLinks(): PaymentLink[] {
    this.initialize();
    return this.data.paymentLinks;
  }

  public static getGatewayAccounts(): GatewayAccount[] {
    this.initialize();
    return this.data.gatewayAccounts;
  }

  public static getTransactions(): Transaction[] {
    this.initialize();
    return this.data.transactions;
  }

  public static getPaymentStatusHistory(): PaymentStatusHistory[] {
    this.initialize();
    return this.data.paymentStatusHistory;
  }

  public static getWebhookLogs(): WebhookLog[] {
    this.initialize();
    return this.data.webhookLogs;
  }

  public static getAuditLogs(): AuditLog[] {
    this.initialize();
    return this.data.auditLogs;
  }

  public static getSystemSettings(): SystemSettings {
    this.initialize();
    return this.data.systemSettings;
  }

  // State mutators
  public static saveAdmins(admins: AdminUser[]): void {
    this.initialize();
    this.data.admins = admins;
    this.persist();
  }

  public static saveCustomers(customers: Customer[]): void {
    this.initialize();
    this.data.customers = customers;
    this.persist();
  }

  public static saveBrands(brands: Brand[]): void {
    this.initialize();
    this.data.brands = brands;
    this.persist();
  }

  public static saveTemplates(templates: BrandTemplate[]): void {
    this.initialize();
    this.data.templates = templates;
    this.persist();
  }

  public static saveTemplateVersions(versions: TemplateVersion[]): void {
    this.initialize();
    this.data.templateVersions = versions;
    this.persist();
  }

  public static savePaymentLinks(links: PaymentLink[]): void {
    this.initialize();
    this.data.paymentLinks = links;
    this.persist();
  }

  public static saveGatewayAccounts(accounts: GatewayAccount[]): void {
    this.initialize();
    this.data.gatewayAccounts = accounts;
    this.persist();
  }

  public static saveTransactions(transactions: Transaction[]): void {
    this.initialize();
    this.data.transactions = transactions;
    this.persist();
  }

  public static savePaymentStatusHistory(history: PaymentStatusHistory[]): void {
    this.initialize();
    this.data.paymentStatusHistory = history;
    this.persist();
  }

  public static saveWebhookLogs(logs: WebhookLog[]): void {
    this.initialize();
    this.data.webhookLogs = logs;
    this.persist();
  }

  public static saveAuditLogs(logs: AuditLog[]): void {
    this.initialize();
    this.data.auditLogs = logs;
    this.persist();
  }

  public static saveNoticeTemplates(templates: NoticeTemplate[]): void {
    this.initialize();
    this.data.noticeTemplates = templates;
    this.persist();
  }

  public static saveSystemSettings(settings: SystemSettings): void {
    this.initialize();
    this.data.systemSettings = settings;
    this.persist();
  }

  public static appendAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): void {
    this.initialize();
    const entry: AuditLog = {
      id: 'audit_' + crypto.randomBytes(6).toString('hex'),
      createdAt: new Date().toISOString(),
      ...log,
    };
    this.data.auditLogs.unshift(entry);
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 1000);
    }
    this.persist();
  }

  /**
   * Data retention automated pruner:
   * Purges Audit Logs older than retentionAuditLogsDays (default 60 days)
   * Purges Webhook Logs older than retentionAuditLogsDays (default 60 days)
   * Purges Payment Links older than retentionPaymentLinksDays (default 90 days)
   */
  public static pruneExpiredData(): {
    prunedAuditLogs: number;
    prunedWebhookLogs: number;
    prunedLinks: number;
    prunedTransactions: number;
    prunedCustomers: number;
  } {
    this.initialize();
    const settings = this.data.systemSettings;
    const auditDays = settings.retentionAuditLogsDays || 60;
    const linkDays = settings.retentionPaymentLinksDays || 90;
    const customerDays = settings.retentionCustomersDays || 60;

    const now = Date.now();
    const auditCutoff = now - auditDays * 86400000;
    const linkCutoff = now - linkDays * 86400000;
    const customerCutoff = now - customerDays * 86400000;

    // Prune audit logs
    const initialAuditCount = this.data.auditLogs.length;
    this.data.auditLogs = this.data.auditLogs.filter(
      (a) => new Date(a.createdAt).getTime() >= auditCutoff
    );
    const prunedAuditLogs = initialAuditCount - this.data.auditLogs.length;

    // Prune webhook logs
    const initialWebhookCount = this.data.webhookLogs.length;
    this.data.webhookLogs = this.data.webhookLogs.filter(
      (w) => new Date(w.createdAt).getTime() >= auditCutoff
    );
    const prunedWebhookLogs = initialWebhookCount - this.data.webhookLogs.length;

    // Prune payment links
    const initialLinkCount = this.data.paymentLinks.length;
    const activeLinks = this.data.paymentLinks.filter(
      (l) => new Date(l.createdAt).getTime() >= linkCutoff
    );
    const keptLinkIds = new Set(activeLinks.map((l) => l.id));
    this.data.paymentLinks = activeLinks;
    const prunedLinks = initialLinkCount - this.data.paymentLinks.length;

    // Prune transactions orphaned by pruned links
    const initialTxCount = this.data.transactions.length;
    this.data.transactions = this.data.transactions.filter(
      (t) => keptLinkIds.has(t.paymentLinkId) || new Date(t.createdAt).getTime() >= linkCutoff
    );
    const prunedTransactions = initialTxCount - this.data.transactions.length;

    // Prune status history
    this.data.paymentStatusHistory = this.data.paymentStatusHistory.filter((h) =>
      keptLinkIds.has(h.paymentLinkId)
    );

    // Prune inactive customers with no active payment links created before cutoff
    const customerIdsWithLinks = new Set(this.data.paymentLinks.map((l) => l.customerId));
    const initialCustomerCount = this.data.customers.length;
    this.data.customers = this.data.customers.filter((c) => {
      // Keep customer if they have any active links, or if created within customerCutoff
      if (customerIdsWithLinks.has(c.id)) return true;
      return new Date(c.createdAt).getTime() >= customerCutoff;
    });
    const prunedCustomers = initialCustomerCount - this.data.customers.length;

    settings.lastPrunedAt = new Date().toISOString();
    this.persist();

    return {
      prunedAuditLogs,
      prunedWebhookLogs,
      prunedLinks,
      prunedTransactions,
      prunedCustomers,
    };
  }
}
