import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Building2,
  Check,
  Clock,
  FileCheck2,
  Mail,
  MapPin,
  Phone,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api.js';
import { HomePageConfig } from '../types/index.js';

const DEFAULT_CONFIG: HomePageConfig = {
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

export const PublicHomePage: React.FC = () => {
  const [config, setConfig] = useState<HomePageConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getPublicHome()
      .then((res) => {
        if (active && res.success && res.config) {
          setConfig({
            ...DEFAULT_CONFIG,
            ...res.config,
            paydayLoansPoints:
              Array.isArray(res.config.paydayLoansPoints) && res.config.paydayLoansPoints.length > 0
                ? res.config.paydayLoansPoints
                : DEFAULT_CONFIG.paydayLoansPoints,
            microLoansPoints:
              Array.isArray(res.config.microLoansPoints) && res.config.microLoansPoints.length > 0
                ? res.config.microLoansPoints
                : DEFAULT_CONFIG.microLoansPoints,
            recoverySteps:
              Array.isArray(res.config.recoverySteps) && res.config.recoverySteps.length > 0
                ? res.config.recoverySteps
                : DEFAULT_CONFIG.recoverySteps,
          });
        }
      })
      .catch(() => {
        // Fallback cleanly to defaults
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (config.companyName) {
      document.title = `${config.companyName} — ${config.tagline || 'Loan Recovery & Credit Advisory'}`;
    }
  }, [config.companyName, config.tagline]);

  const accent = config.accentColor || '#0f766e';

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-900 antialiased selection:bg-teal-100 selection:text-teal-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-[#fafaf9]/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between gap-6">
          <a href="#top" className="flex items-center gap-3 group">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-tight shrink-0"
              style={{ backgroundColor: accent }}
            >
              {(config.companyName || 'A').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold tracking-tight text-slate-900 truncate">
                {config.companyName}
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate hidden sm:block">
                {config.tagline}
              </div>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600">
            <a href="#about" className="hover:text-slate-900 transition-colors">
              About Us
            </a>
            <a href="#payday-loans" className="hover:text-slate-900 transition-colors">
              Payday Loans
            </a>
            <a href="#micro-loans" className="hover:text-slate-900 transition-colors">
              Micro Loans
            </a>
            <a href="#recovery-process" className="hover:text-slate-900 transition-colors">
              Recovery Process
            </a>
            <a
              href="#contact"
              className="px-4 py-2 rounded-lg text-white font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              Contact Desk
            </a>
          </nav>
        </div>
      </header>

      <main id="top" className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-95'}`}>
        {/* Hero & Company Practice Split */}
        <section id="about" className="border-b border-stone-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-7 space-y-6">
              <p
                className="text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: accent }}
              >
                {config.heroEyebrow}
              </p>

              <h1 className="font-editorial text-4xl sm:text-5xl font-semibold text-slate-900 leading-[1.12] tracking-tight">
                {config.heroHeadline}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                {config.heroSubheadline}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3.5">
                <a
                  href="#payday-loans"
                  className="px-5 py-3 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  Read Loan Knowledge Guides
                </a>
                <a
                  href="#recovery-process"
                  className="px-5 py-3 rounded-lg text-sm font-semibold text-slate-800 border border-stone-300 bg-white hover:bg-stone-50 transition-colors"
                >
                  Our Recovery Approach
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-[#fafaf9] border border-stone-200 rounded-xl p-7 space-y-5">
                <div className="flex items-center gap-2.5 text-slate-900">
                  <Building2 size={18} style={{ color: accent }} />
                  <h2 className="text-base font-bold tracking-tight">{config.aboutTitle}</h2>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  {config.aboutDescription}
                </p>

                <div className="pt-4 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      Resolution Helpline
                    </div>
                    <div className="font-semibold text-slate-900 mt-1">{config.contactPhone}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      Support Hours
                    </div>
                    <div className="font-semibold text-slate-900 mt-1">{config.workingHours}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Educational Guides: Payday Loans & Micro Loans */}
        <section className="max-w-6xl mx-auto px-6 py-16 lg:py-20 space-y-10">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>
              BORROWER KNOWLEDGE CENTER
            </p>
            <h2 className="font-editorial text-3xl font-semibold text-slate-900 tracking-tight">
              Payday Loans &amp; Micro Loans Explained
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Clear financial awareness helps borrowers evaluate short-term credit commitments and resolve overdue balances before late charges escalate.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Payday Loans */}
            <article
              id="payday-loans"
              className="bg-white border border-stone-200 rounded-xl p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <BookOpen size={18} style={{ color: accent }} />
                    <h3 className="font-editorial text-2xl font-semibold text-slate-900">
                      {config.paydayLoansTitle}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-stone-400 tabular-nums">01</span>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  {config.paydayLoansSummary}
                </p>

                <ul className="space-y-3 pt-2">
                  {config.paydayLoansPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                      <Check
                        size={16}
                        className="mt-1 shrink-0"
                        style={{ color: accent }}
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-stone-100 text-xs text-slate-500">
                Typical cycle: Short-term salary bridge • Prioritize on-time full closure to avoid penal interest.
              </div>
            </article>

            {/* Micro Loans */}
            <article
              id="micro-loans"
              className="bg-white border border-stone-200 rounded-xl p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Scale size={18} style={{ color: accent }} />
                    <h3 className="font-editorial text-2xl font-semibold text-slate-900">
                      {config.microLoansTitle}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-stone-400 tabular-nums">02</span>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  {config.microLoansSummary}
                </p>

                <ul className="space-y-3 pt-2">
                  {config.microLoansPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                      <Check
                        size={16}
                        className="mt-1 shrink-0"
                        style={{ color: accent }}
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-stone-100 text-xs text-slate-500">
                Typical cycle: Installment-based credit • Supports personal cash flow &amp; credit score stability.
              </div>
            </article>
          </div>
        </section>

        {/* Recovery Process */}
        <section id="recovery-process" className="border-y border-stone-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20 space-y-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>
                STRUCTURED RESOLUTION
              </p>
              <h2 className="font-editorial text-3xl font-semibold text-slate-900 tracking-tight">
                {config.recoveryTitle}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {config.recoverySubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {config.recoverySteps.map((step, index) => (
                <div
                  key={index}
                  className="bg-[#fafaf9] border border-stone-200 rounded-xl p-6 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-bold tracking-wider uppercase"
                      style={{ color: accent }}
                    >
                      Step 0{index + 1}
                    </span>
                    <FileCheck2 size={16} className="text-slate-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{step.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>

            {/* Fair Practice Notice */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 flex items-start gap-4">
              <ShieldCheck size={20} className="shrink-0 mt-0.5" style={{ color: accent }} />
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {config.complianceNotice}
              </p>
            </div>
          </div>
        </section>

        {/* Contact & Footer */}
        <footer id="contact" className="bg-slate-900 text-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-12 gap-10 border-b border-slate-800">
            <div className="md:col-span-5 space-y-3">
              <div className="text-lg font-bold text-white tracking-tight">
                {config.companyName}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                {config.tagline}. Dedicated to respectful communication, accurate account reconciliation, and borrower clarity.
              </p>
            </div>

            <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Borrower Assistance Desk
                </div>
                <div className="flex items-center gap-2.5 text-slate-200">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  <span>{config.contactEmail}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-200">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  <span>{config.contactPhone}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Office &amp; Hours
                </div>
                <div className="flex items-start gap-2.5 text-slate-200">
                  <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{config.officeAddress}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-200">
                  <Clock size={14} className="text-slate-400 shrink-0" />
                  <span>{config.workingHours}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>{config.footerCopyright}</span>
            <span>Ethical Receivables &amp; Credit Awareness Portal</span>
          </div>
        </footer>
      </main>
    </div>
  );
};
