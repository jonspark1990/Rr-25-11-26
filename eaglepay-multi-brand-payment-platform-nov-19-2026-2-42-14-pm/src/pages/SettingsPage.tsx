import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  MessageSquare,
  KeyRound,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Check,
  Copy,
  Sparkles,
  Save,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  UserX,
  Lock,
  Mail,
  User,
  Sliders,
  HelpCircle,
  X,
  Eye,
  EyeOff,
  QrCode,
  Database,
  Calendar,
  Flame,
  Shield,
  RotateCcw,
  CheckSquare,
  Square,
  CheckCircle2,
  Activity,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api.js';
import { AdminUser, HomePageConfig, NoticeTemplate, UserRole } from '../types/index.js';
import { TeamMemberDossierModal } from '../components/TeamMemberDossierModal.js';

export const ALL_AVAILABLE_PERMISSIONS = [
  { id: 'customers:view', label: 'View Customers', desc: 'Browse customer directory & KYC details' },
  { id: 'customers:edit', label: 'Manage Customers', desc: 'Add, update details, or bulk delete customer records' },
  { id: 'links:view', label: 'View Links & Transactions', desc: 'Access generated payment links and transactions' },
  { id: 'links:create', label: 'Create Payment Links', desc: 'Generate new branded payment link checkout URLs' },
  { id: 'templates:manage', label: 'Manage Brands & Templates', desc: 'Custom HTML template editor & brand styles' },
  { id: 'gateways:manage', label: 'Gateways & Webhooks', desc: 'Configure AppAssistServices credentials & webhook simulator' },
  { id: 'analytics:view', label: 'Reports & Analytics', desc: 'View agent performance, collection metrics & export CSV' },
  { id: 'audit_logs:view', label: 'Audit Logs', desc: 'Inspect system and security action history' },
  { id: 'system:settings', label: 'System Settings', desc: 'Extreme admin system settings & retention controls' },
];

interface SettingsPageProps {
  currentUser: AdminUser;
  onUpdateCurrentUser?: (updated: AdminUser) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  currentUser,
  onUpdateCurrentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'notices' | 'homepage' | 'team' | 'security' | 'system'>('notices');

  // --- PUBLIC HOME PAGE CUSTOMIZER STATE ---
  const [homeConfig, setHomeConfig] = useState<HomePageConfig>({
    companyName: 'AppAssistServices',
    tagline: 'Ethical Loan Recovery & Borrower Resolution Advisory',
    heroEyebrow: 'CREDIT RESOLUTION & BORROWER EDUCATION',
    heroHeadline: 'Fair, Transparent Loan Recovery & Financial Guidance',
    heroSubheadline:
      'We partner with lending institutions and borrowers to resolve overdue accounts respectfully—providing clear repayment pathways and practical education on Payday Loans and Micro Loans.',
    aboutTitle: 'About Our Recovery Practice',
    aboutDescription: '',
    paydayLoansTitle: 'Understanding Payday Loans',
    paydayLoansSummary: '',
    paydayLoansPoints: [],
    microLoansTitle: 'Understanding Micro Loans',
    microLoansSummary: '',
    microLoansPoints: [],
    recoveryTitle: 'How Our Loan Recovery Process Works',
    recoverySubtitle: '',
    recoverySteps: [],
    complianceNotice: '',
    contactEmail: '',
    contactPhone: '',
    officeAddress: '',
    workingHours: '',
    footerCopyright: '',
    accentColor: '#0f766e',
  });
  const [savingHomeConfig, setSavingHomeConfig] = useState(false);
  const [homeConfigMsg, setHomeConfigMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- NOTICE TEMPLATES STATE ---
  const [templates, setTemplates] = useState<NoticeTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<NoticeTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateIsDefault, setTemplateIsDefault] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSuccessMsg, setTemplateSuccessMsg] = useState<string | null>(null);
  const [templateErrorMsg, setTemplateErrorMsg] = useState<string | null>(null);
  const [showAiNoticeModal, setShowAiNoticeModal] = useState(false);
  const [copiedAiPrompt, setCopiedAiPrompt] = useState(false);

  // --- TEAM MANAGEMENT STATE ---
  const [team, setTeam] = useState<AdminUser[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('link_creator');
  const [newPermissions, setNewPermissions] = useState<string[]>(['links:create', 'links:view', 'customers:view']);
  const [newTwoFactorRequired, setNewTwoFactorRequired] = useState(false);
  const [teamActionLoading, setTeamActionLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);
  const [editMemberModal, setEditMemberModal] = useState<AdminUser | null>(null);
  const [editMemberRole, setEditMemberRole] = useState<UserRole>('link_creator');
  const [editMemberPassword, setEditMemberPassword] = useState('');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editTwoFactorRequired, setEditTwoFactorRequired] = useState(false);
  const [resetting2faUserId, setResetting2faUserId] = useState<string | null>(null);
  const [selectedDossierMemberId, setSelectedDossierMemberId] = useState<string | null>(null);

  // --- SECURITY & PASSWORD STATE ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile update
  const [profileUsername, setProfileUsername] = useState(currentUser.username);
  const [profileName, setProfileName] = useState(currentUser.name || '');
  const [profileEmail, setProfileEmail] = useState(currentUser.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- SYSTEM & RETENTION SETTINGS STATE ---
  const [systemSettings, setSystemSettings] = useState<any>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [maintenanceStats, setMaintenanceStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [purgingData, setPurgingData] = useState(false);
  const [purgeResult, setPurgeResult] = useState<any>(null);
  const [showSuperKey, setShowSuperKey] = useState(false);
  const [customSuperKeyInput, setCustomSuperKeyInput] = useState('');
  const [rotatingKey, setRotatingKey] = useState(false);

  // Load Templates
  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await api.getNoticeTemplates();
      if (res.success && res.templates) {
        setTemplates(res.templates);
        if (!selectedTemplate && res.templates.length > 0) {
          selectTemplateForEdit(res.templates[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Load Team
  const loadTeam = async () => {
    try {
      setLoadingTeam(true);
      const res = await api.getTeamMembers();
      if (res.success && res.team) {
        setTeam(res.team);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTeam(false);
    }
  };

  // Load System Settings
  const loadSettings = async () => {
    try {
      const res = await api.getSettings();
      if (res.success && res.settings) {
        setSystemSettings(res.settings);
        if (res.settings.homePageConfig) {
          setHomeConfig(res.settings.homePageConfig);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load Maintenance Stats
  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const res = await api.getMaintenanceStats();
      if (res.success && res.stats) {
        setMaintenanceStats(res.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    loadTeam();
    loadSettings();
    loadStats();
  }, []);

  const getDefaultPermissionsForRole = (role: UserRole): string[] => {
    switch (role) {
      case 'link_creator':
        return ['links:create', 'links:view', 'customers:view'];
      case 'template_designer':
        return ['templates:manage'];
      case 'manager':
        return ['links:view', 'customers:view', 'analytics:view', 'audit_logs:view'];
      case 'admin':
      case 'super_admin':
        return ALL_AVAILABLE_PERMISSIONS.map((p) => p.id);
      default:
        return ['links:view'];
    }
  };

  const selectTemplateForEdit = (tpl: NoticeTemplate) => {
    setSelectedTemplate(tpl);
    setTemplateName(tpl.name);
    setTemplateDesc(tpl.description || '');
    setTemplateContent(tpl.content);
    setTemplateIsDefault(tpl.isDefault);
    setIsEditingTemplate(true);
    setTemplateSuccessMsg(null);
    setTemplateErrorMsg(null);
  };

  const handleNewTemplateClick = () => {
    setSelectedTemplate(null);
    setTemplateName('New Collection Template');
    setTemplateDesc('Custom loan recovery message');
    setTemplateContent(`Dear {{customer.name}},

Your settlement offer of INR {{payment.amount}}/- for order {{payment.loan_order_number}} is valid today.
Pay now: {{payment.link}}

Recovery Dept, {{brand.name}}`);
    setTemplateIsDefault(false);
    setIsEditingTemplate(true);
    setTemplateSuccessMsg(null);
    setTemplateErrorMsg(null);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !templateContent.trim()) {
      setTemplateErrorMsg('Template Name and Content are required.');
      return;
    }

    try {
      setSavingTemplate(true);
      setTemplateErrorMsg(null);
      setTemplateSuccessMsg(null);

      if (selectedTemplate) {
        // Update
        const res = await api.updateNoticeTemplate(selectedTemplate.id, {
          name: templateName,
          description: templateDesc,
          content: templateContent,
          isDefault: templateIsDefault,
        });

        if (res.success) {
          setTemplateSuccessMsg('Template updated successfully!');
          await loadTemplates();
          setSelectedTemplate(res.template);
        }
      } else {
        // Create
        const res = await api.createNoticeTemplate({
          name: templateName,
          description: templateDesc,
          content: templateContent,
          isDefault: templateIsDefault,
        });

        if (res.success) {
          setTemplateSuccessMsg('New template created successfully!');
          await loadTemplates();
          setSelectedTemplate(res.template);
        }
      }
    } catch (err: any) {
      setTemplateErrorMsg(err.message || 'Failed to save template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notice template?')) return;
    try {
      await api.deleteNoticeTemplate(id);
      await loadTemplates();
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
        setIsEditingTemplate(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const insertVariable = (variable: string) => {
    setTemplateContent((prev) => prev + variable);
  };

  // Live preview rendered text
  const previewText = templateContent
    .replaceAll('{{customer.name}}', 'BAIJAYANTI CHHURA')
    .replaceAll('{{payment.amount}}', '1,338')
    .replaceAll('{{payment.link}}', 'https://domain.com/apex/PAY9821X4')
    .replaceAll('{{payment.url}}', 'https://domain.com/apex/PAY9821X4')
    .replaceAll('{{brand.name}}', 'ArspLoan')
    .replaceAll('{{payment.loan_order_number}}', '2181993')
    .replaceAll('{{customer.pan}}', 'DOJPC3710R')
    .replaceAll('{{customer.bank_account}}', 'XX9912')
    .replaceAll('{{customer.executive_name}}', 'R. Sharma')
    .replaceAll('{{payment.repayment_date}}', 'Today Only')
    .replaceAll('{{customer.masked_mobile}}', '98****3210')
    .replaceAll('{{brand.support_phone}}', '+91 800-444-0000');

  // AI Prompt for generating notice templates
  const aiNoticePromptText = `Act as an expert banking collections and recovery communication specialist for a digital NBFC loan app.
Create a high-impact, professional collection notice message template that will be sent via SMS / WhatsApp to customers with overdue loans.

Use the following exact placeholders:
- {{customer.name}} -> Customer full name (e.g. BAIJAYANTI CHHURA)
- {{payment.amount}} -> Approved settlement amount (e.g. 1,338)
- {{payment.link}} -> Unique payment link URL
- {{brand.name}} -> NBFC / Loan company name (e.g. ArspLoan)
- {{payment.loan_order_number}} -> Loan account / Order number (e.g. 2181993)
- {{customer.pan}} -> PAN Number (e.g. DOJPC3710R)
- {{customer.masked_mobile}} -> Masked mobile number
- {{customer.executive_name}} -> Field / Recovery officer name

Requirements:
1. Tone options: Urgent Legal Warning / One-Time Discount Settlement / Formal Repayment Reminder.
2. Must clearly highlight that clearing via {{payment.link}} stops field visits and CIBIL reporting.
3. Clean formatting with emojis and bullet points suitable for WhatsApp and SMS.
4. Output ready-to-use template text without markdown code blocks.`;

  // Team Actions
  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamActionLoading(true);
    setTeamError(null);
    setTeamSuccess(null);

    try {
      const res = await api.createTeamMember({
        username: newUsername.trim(),
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        permissions: newPermissions,
        twoFactorRequired: newTwoFactorRequired,
      });

      if (res.success) {
        setTeamSuccess(`Team member "${newUsername}" added successfully!`);
        setShowAddTeamModal(false);
        setNewUsername('');
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('link_creator');
        setNewPermissions(getDefaultPermissionsForRole('link_creator'));
        setNewTwoFactorRequired(false);
        await loadTeam();
      }
    } catch (err: any) {
      setTeamError(err.message || 'Failed to add team member.');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleUpdateMemberRoleOrPassword = async () => {
    if (!editMemberModal) return;
    try {
      setTeamActionLoading(true);
      const payload: any = {
        role: editMemberRole,
        permissions: editPermissions,
        twoFactorRequired: editTwoFactorRequired,
      };
      if (editMemberPassword.trim()) {
        payload.newPassword = editMemberPassword.trim();
      }

      const res = await api.updateTeamMember(editMemberModal.id, payload);
      if (res.success) {
        setEditMemberModal(null);
        setEditMemberPassword('');
        setTeamSuccess(`Team member "${editMemberModal.username}" updated successfully!`);
        await loadTeam();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update member');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleReset2fa = async (member: AdminUser) => {
    if (!confirm(`Reset Google Authenticator 2FA secret for "${member.username}"? On their next login, they will receive a fresh QR code setup.`)) return;
    try {
      setResetting2faUserId(member.id);
      const res = await api.resetTeam2fa(member.id);
      if (res.success) {
        alert(`Google Authenticator 2FA secret for ${member.username} was reset successfully. They can now bind a fresh authenticator.`);
        await loadTeam();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reset 2FA');
    } finally {
      setResetting2faUserId(null);
    }
  };

  // System & Retention Actions
  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setSettingsMsg(null);
      const res = await api.updateSettings(systemSettings);
      if (res.success && res.settings) {
        setSystemSettings(res.settings);
        if (res.settings.homePageConfig) {
          setHomeConfig(res.settings.homePageConfig);
        }
        setSettingsMsg('Global system settings and retention policies saved successfully.');
        await loadStats();
      }
    } catch (err: any) {
      setSettingsMsg(err.message || 'Failed to save system settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveHomeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingHomeConfig(true);
      setHomeConfigMsg(null);
      const cleanedConfig: HomePageConfig = {
        ...homeConfig,
        paydayLoansPoints: homeConfig.paydayLoansPoints.map((p) => p.trim()).filter(Boolean),
        microLoansPoints: homeConfig.microLoansPoints.map((p) => p.trim()).filter(Boolean),
        recoverySteps: homeConfig.recoverySteps.filter((s) => s.title.trim() || s.description.trim()),
      };
      const res = await api.updateSettings({ homePageConfig: cleanedConfig });
      if (res.success && res.settings) {
        setSystemSettings(res.settings);
        if (res.settings.homePageConfig) {
          setHomeConfig(res.settings.homePageConfig);
        }
        setHomeConfigMsg({
          type: 'success',
          text: 'Public Home Page content updated! Visitors at "/" will see these changes immediately.',
        });
      }
    } catch (err: any) {
      setHomeConfigMsg({
        type: 'error',
        text: err.message || 'Failed to save public home page configuration.',
      });
    } finally {
      setSavingHomeConfig(false);
    }
  };

  const handleRotateSuperKey = async () => {
    if (!confirm('Rotate Emergency Master Super Key? Any staff using the old emergency key will need the new key.')) return;
    try {
      setRotatingKey(true);
      const res = await api.rotateSuperKey(customSuperKeyInput.trim() || undefined);
      if (res.success && res.superBypassKey) {
        setSystemSettings((prev: any) => ({ ...prev, superBypassKey: res.superBypassKey }));
        setCustomSuperKeyInput('');
        alert('Master Super Key updated successfully: ' + res.superBypassKey);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to rotate super key');
    } finally {
      setRotatingKey(false);
    }
  };

  const handlePruneNow = async () => {
    if (!confirm('Run data retention cleanup now? Records older than configured limits (Audit Logs: 60d, Inactive Customers: 60d, Payment Links: 90d) will be permanently dropped.')) return;
    try {
      setPurgingData(true);
      const res = await api.pruneExpiredData();
      if (res.success) {
        setPurgeResult(res.result);
        alert(`Cleanup complete: Dropped ${res.result.prunedAuditLogs} audit logs, ${res.result.prunedWebhookLogs} webhook logs, ${res.result.prunedLinks} links, ${res.result.prunedCustomers} inactive customers.`);
        await loadStats();
        await loadSettings();
      }
    } catch (err: any) {
      alert(err.message || 'Data cleanup failed');
    } finally {
      setPurgingData(false);
    }
  };

  const handleToggleMemberStatus = async (member: AdminUser) => {
    try {
      await api.updateTeamMember(member.id, { isActive: !member.isActive });
      await loadTeam();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDeleteMember = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to delete team member "${username}"?`)) return;
    try {
      await api.deleteTeamMember(id);
      await loadTeam();
    } catch (err: any) {
      alert(err.message || 'Failed to delete member');
    }
  };

  // Password & Profile
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newAdminPassword !== confirmAdminPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (newAdminPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await api.changePassword({
        currentPassword,
        newPassword: newAdminPassword,
      });

      if (res.success) {
        setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewAdminPassword('');
        setConfirmAdminPassword('');
      }
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    try {
      setProfileLoading(true);
      const res = await api.updateProfile({
        username: profileUsername,
        name: profileName,
        email: profileEmail,
      });

      if (res.success && res.user) {
        setProfileMsg({ type: 'success', text: 'Profile details saved!' });
        if (onUpdateCurrentUser) onUpdateCurrentUser(res.user);
      }
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">Super Admin</span>;
      case 'admin':
        return <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">Admin</span>;
      case 'manager':
        return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">Manager</span>;
      case 'link_creator':
        return <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">Link Creator</span>;
      case 'template_designer':
        return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">Template Designer</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium">{role}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Platform Settings & Team</h1>
          <p className="text-xs text-slate-500">
            Customize notice templates, manage team permissions, and configure security
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => setActiveTab('notices')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'notices'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <MessageSquare size={14} />
            <span>Notice Templates</span>
          </button>

          <button
            onClick={() => setActiveTab('homepage')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'homepage'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Globe size={14} />
            <span>Public Home Page</span>
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'team'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users size={14} />
            <span>Team & Permissions</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'security'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <KeyRound size={14} />
            <span>Admin Password</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'system'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sliders size={14} />
            <span>Extreme Admin & Retention</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: NOTICE TEMPLATES CUSTOMIZER */}
      {/* ============================================================== */}
      {activeTab === 'notices' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Template List (Left 4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Notice Templates ({templates.length})
                </span>
                <button
                  onClick={handleNewTemplateClick}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition"
                >
                  <Plus size={13} />
                  <span>New Template</span>
                </button>
              </div>

              {loadingTemplates ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-teal-600" />
                  Loading templates...
                </div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => selectTemplateForEdit(tpl)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                        selectedTemplate?.id === tpl.id
                          ? 'bg-teal-50/70 border-teal-500 shadow-2xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {tpl.name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {tpl.description || 'No description'}
                          </div>
                        </div>
                        {tpl.isDefault && (
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Generator CTA Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-md border border-indigo-800/50 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-300" />
                <span className="text-xs font-bold tracking-tight text-white">
                  AI Recovery Prompt Generator
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Feed this structured prompt with ready placeholders to ChatGPT / Claude / Gemini to generate aggressive, legal, or polite recovery notice templates in any language.
              </p>
              <button
                type="button"
                onClick={() => setShowAiNoticeModal(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition"
              >
                <span>View & Copy AI Prompt</span>
              </button>
            </div>
          </div>

          {/* Template Editor & Live Preview (Right 8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedTemplate ? `Edit Template: ${selectedTemplate.name}` : 'Create Notice Template'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Use tags like <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">{'{{customer.name}}'}</code> to automatically populate customer data
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedTemplate && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                      className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition text-xs"
                      title="Delete Template"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition"
                  >
                    {savingTemplate ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    <span>Save Template</span>
                  </button>
                </div>
              </div>

              {templateSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  <span>{templateSuccessMsg}</span>
                </div>
              )}

              {templateErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle size={15} />
                  <span>{templateErrorMsg}</span>
                </div>
              )}

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g. Urgent One-Time Settlement"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Description / Purpose
                  </label>
                  <input
                    type="text"
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g. Sent for final settlement clearance"
                  />
                </div>
              </div>

              {/* Default Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="defaultTplCheck"
                  checked={templateIsDefault}
                  onChange={(e) => setTemplateIsDefault(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="defaultTplCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Set as Primary Default Template (Auto-selected when copying link)
                </label>
              </div>

              {/* Placeholders Quick Insertion Pills */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Click to Insert Dynamic Placeholders:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: '{{customer.name}}', label: 'Customer Name' },
                    { tag: '{{payment.amount}}', label: 'Amount' },
                    { tag: '{{payment.link}}', label: 'Payment Link URL' },
                    { tag: '{{brand.name}}', label: 'Brand Name' },
                    { tag: '{{payment.loan_order_number}}', label: 'Loan Order NO' },
                    { tag: '{{customer.pan}}', label: 'PAN Card' },
                    { tag: '{{customer.bank_account}}', label: 'Bank Account' },
                    { tag: '{{customer.executive_name}}', label: 'Executive' },
                    { tag: '{{customer.masked_mobile}}', label: 'Masked Mobile' },
                    { tag: '{{payment.repayment_date}}', label: 'Repayment Date' },
                    { tag: '{{brand.support_phone}}', label: 'Support Phone' },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => insertVariable(item.tag)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 text-slate-700 text-[11px] font-mono transition"
                    >
                      + {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Content Editor */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Message Content (Raw Template)
                </label>
                <textarea
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  rows={9}
                  className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-900 leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  placeholder="Type your message template here..."
                />
              </div>

              {/* Live Preview Section */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Eye size={13} className="text-teal-600" />
                    <span>Real-Time Customer Preview (Populated Sample)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {previewText.length} characters
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all shadow-inner border border-slate-800">
                  {previewText}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: TEAM MANAGEMENT & PERMISSIONS */}
      {/* ============================================================== */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Team Members & Role Access Control</h3>
                <p className="text-xs text-slate-500">
                  Add staff with restricted permissions (e.g. only link creations, template design, or management)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddTeamModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition"
              >
                <Plus size={14} />
                <span>Add Team Member</span>
              </button>
            </div>

            {teamSuccess && (
              <div className="p-3 mb-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{teamSuccess}</span>
              </div>
            )}

            {/* Team Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Google 2FA</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-[10px] uppercase">
                            {member.username.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{member.name || member.username}</span>
                            <span className="text-[11px] text-slate-400 font-mono">@{member.username}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {member.email}
                      </td>

                      <td className="py-3 px-4">
                        {getRoleBadge(member.role)}
                      </td>

                      <td className="py-3 px-4">
                        {member.twoFactorEnabled ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <ShieldCheck size={12} className="text-emerald-600" />
                            <span>Active TOTP</span>
                          </span>
                        ) : member.twoFactorRequired || systemSettings.enforceTwoFactorAllAdmins ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <QrCode size={12} className="text-amber-600" />
                            <span>Required on Login</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-medium">
                            Normal Password
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {member.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Disabled
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedDossierMemberId(member.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition"
                            title="View Created Links (Today/Yesterday) & Activity Dossier"
                          >
                            <Activity size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditMemberModal(member);
                              setEditMemberRole(member.role);
                              setEditMemberPassword('');
                              setEditPermissions(member.permissions || getDefaultPermissionsForRole(member.role));
                              setEditTwoFactorRequired(Boolean(member.twoFactorRequired));
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-slate-100 transition"
                            title="Edit Permissions, Role or Reset Password"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            disabled={resetting2faUserId === member.id}
                            onClick={() => handleReset2fa(member)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="Reset Google Authenticator (Re-bind QR)"
                          >
                            <RotateCcw size={13} className={resetting2faUserId === member.id ? 'animate-spin' : ''} />
                          </button>

                          {member.id !== currentUser.id && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleMemberStatus(member)}
                                className={`p-1.5 rounded-lg transition ${
                                  member.isActive !== false
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={member.isActive !== false ? 'Deactivate Member' : 'Activate Member'}
                              >
                                {member.isActive !== false ? <UserX size={13} /> : <UserCheck size={13} />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteMember(member.id, member.username)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition"
                                title="Delete Member"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Permissions Matrix Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Permission Role Definitions:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-teal-800 block">1. link_creator</span>
                <p className="text-slate-600 text-[11px]">
                  Can ONLY generate payment links, copy notice templates, and view customer directory. Cannot edit HTML or gateways.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-amber-800 block">2. template_designer</span>
                <p className="text-slate-600 text-[11px]">
                  Can ONLY design checkout HTML templates and customize recovery SMS/WhatsApp notice templates.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-blue-800 block">3. manager</span>
                <p className="text-slate-600 text-[11px]">
                  Can view transactions, payment links, export financial reports, and recheck gateway status.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-indigo-800 block">4. admin</span>
                <p className="text-slate-600 text-[11px]">
                  Full administrative access to manage gateways, audit logs, team members, and system configurations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: ADMIN SECURITY & PASSWORD */}
      {/* ============================================================== */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Change Password Card */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Change Admin Password</h3>
                <p className="text-xs text-slate-500">Update your account login password with PBKDF2 encryption</p>
              </div>
            </div>

            {passwordMsg && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {passwordMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  New Password (min 6 chars)
                </label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  required
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmAdminPassword}
                  onChange={(e) => setConfirmAdminPassword(e.target.value)}
                  required
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  placeholder="Re-type new password"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition"
              >
                {passwordLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Update Password</span>
              </button>
            </form>
          </div>

          {/* Profile Details Card */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                <User size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Admin Account Profile</h3>
                <p className="text-xs text-slate-500">Update display name, username, and contact email</p>
              </div>
            </div>

            {profileMsg && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  profileMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {profileMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Username (Login Identifier)
                </label>
                <input
                  type="text"
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value)}
                  required
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Full Display Name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-1">
                <span className="text-[11px] text-slate-500 block">
                  Current Role: <span className="font-bold text-slate-800 uppercase">{currentUser.role}</span>
                </span>
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
              >
                {profileLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Profile Details</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: EXTREME ADMIN & RETENTION ENGINE */}
      {/* ============================================================== */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {settingsMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{settingsMsg}</span>
              </div>
              <button onClick={() => setSettingsMsg(null)} className="text-emerald-700 hover:text-emerald-900">
                <X size={15} />
              </button>
            </div>
          )}

          {/* Section 1: Google Authenticator & Master Super Key Governance */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-2xs">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Google Authenticator (TOTP) &amp; Master Super Key</h3>
                  <p className="text-xs text-slate-500">Configure mandatory 2FA enforcement and emergency master bypass credentials</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Global 2FA Policy Switch */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Enforce Google Authenticator for All Team Members</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      When turned on, ANY team member logging in will be prompted for their 6-digit Authenticator code. First-time users will be shown the QR code to bind immediately.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(systemSettings.enforceTwoFactorAllAdmins)}
                      onChange={(e) =>
                        setSystemSettings({ ...systemSettings, enforceTwoFactorAllAdmins: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                  <QrCode size={14} className="text-teal-600 shrink-0" />
                  <span>Individual team members can also be marked "2FA Required" in the Team tab.</span>
                </div>
              </div>

              {/* Master Super Bypass Key */}
              <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400">
                    <KeyRound size={15} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Emergency Master Super Key</h4>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                    SUPER ADMIN ONLY
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  If an admin loses their smartphone or Google Authenticator app, this master key can be entered directly on the login screen to bypass the 2FA challenge.
                </p>

                <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <code className="flex-1 font-mono text-xs text-amber-300 tracking-wider font-bold truncate">
                    {showSuperKey ? systemSettings.superBypassKey || 'EAGLE-SUPER-MASTER-9988' : '••••••••••••••••••••••••••••'}
                  </code>
                  <button
                    type="button"
                    onClick={() => setShowSuperKey(!showSuperKey)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title={showSuperKey ? 'Hide Key' : 'Reveal Key'}
                  >
                    {showSuperKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(systemSettings.superBypassKey || 'EAGLE-SUPER-MASTER-9988');
                      alert('Master Super Key copied to clipboard!');
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
                    title="Copy Key"
                  >
                    <Copy size={13} />
                  </button>
                </div>

                {currentUser.role === 'super_admin' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Custom key (or leave empty to auto-generate)"
                      value={customSuperKeyInput}
                      onChange={(e) => setCustomSuperKeyInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      disabled={rotatingKey}
                      onClick={handleRotateSuperKey}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw size={12} className={rotatingKey ? 'animate-spin' : ''} />
                      <span>Rotate Key</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Automated 60-Day & 90-Day Retention Engine */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Automated Data Retention &amp; Auto-Purge Engine</h3>
                  <p className="text-xs text-slate-500">
                    Automatically drops heavy audit logs (60 days), inactive customers (60 days), and payment links (90 days)
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={purgingData}
                onClick={handlePruneNow}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Flame size={14} className={purgingData ? 'animate-spin' : ''} />
                <span>{purgingData ? 'Purging Expired Data...' : 'Run Retention Purge Now'}</span>
              </button>
            </div>

            {/* Retention Policies Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Audit &amp; Webhook Logs</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">60 Days</span>
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {maintenanceStats?.totalAuditLogs || 0} total
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Expired (&gt;60d):</span>
                  <span className="font-bold text-rose-600 font-mono">{maintenanceStats?.expiredAuditLogs || 0} records</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer Directory</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">60 Days</span>
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {maintenanceStats?.totalCustomers || 0} records
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Single/Bulk Delete:</span>
                  <span className="font-bold text-teal-600">Enabled in Directory</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Links &amp; Sessions</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">90 Days</span>
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {maintenanceStats?.totalPaymentLinks || 0} generated
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Expired (&gt;90d):</span>
                  <span className="font-bold text-rose-600 font-mono">{maintenanceStats?.expiredLinks || 0} records</span>
                </div>
              </div>
            </div>

            {/* Retention Configurations Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Audit Logs Retention (Days)
                </label>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={systemSettings.retentionAuditLogsDays || 60}
                  onChange={(e) =>
                    setSystemSettings({ ...systemSettings, retentionAuditLogsDays: Number(e.target.value) })
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: 60 days before purge</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Customer Records Retention (Days)
                </label>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={systemSettings.retentionCustomersDays || 60}
                  onChange={(e) =>
                    setSystemSettings({ ...systemSettings, retentionCustomersDays: Number(e.target.value) })
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: 60 days inactive purge</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Payment Links Retention (Days)
                </label>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={systemSettings.retentionPaymentLinksDays || 90}
                  onChange={(e) =>
                    setSystemSettings({ ...systemSettings, retentionPaymentLinksDays: Number(e.target.value) })
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: 90 days before drop</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <span>Last Automated Purge: {maintenanceStats?.lastPrunedAt ? new Date(maintenanceStats.lastPrunedAt).toLocaleString() : 'System Boot'}</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={systemSettings.autoPruneEnabled !== false}
                  onChange={(e) => setSystemSettings({ ...systemSettings, autoPruneEnabled: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Auto-Purge Background Worker Active</span>
              </label>
            </div>
          </div>

          {/* Section 3: Global Platform Configuration & Defaults */}
          <form onSubmit={handleSaveSystemSettings} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
                <Sliders size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Platform Deployment &amp; Gateway Variables</h3>
                <p className="text-xs text-slate-500">Configure global domains, base currencies, and support routes</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Platform Name</label>
                <input
                  type="text"
                  value={systemSettings.siteName || ''}
                  onChange={(e) => setSystemSettings({ ...systemSettings, siteName: e.target.value })}
                  placeholder="AppAssistServices"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Production Domain / Site URL</label>
                <input
                  type="text"
                  value={systemSettings.siteUrl || ''}
                  onChange={(e) => setSystemSettings({ ...systemSettings, siteUrl: e.target.value })}
                  placeholder="https://vardanloan.eu.cc"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Default Base Currency</label>
                <input
                  type="text"
                  value={systemSettings.defaultCurrency || 'INR'}
                  onChange={(e) => setSystemSettings({ ...systemSettings, defaultCurrency: e.target.value.toUpperCase() })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Default Link Expiry (Hours)</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={systemSettings.defaultExpiryHours || 72}
                  onChange={(e) => setSystemSettings({ ...systemSettings, defaultExpiryHours: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Support Contact Email</label>
                <input
                  type="email"
                  value={systemSettings.supportEmail || ''}
                  onChange={(e) => setSystemSettings({ ...systemSettings, supportEmail: e.target.value })}
                  placeholder="support@domain.com"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Maintenance Mode</span>
                  <span className="text-[11px] text-slate-500">Temporarily suspends checkout links for upgrades</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(systemSettings.maintenanceMode)}
                    onChange={(e) => setSystemSettings({ ...systemSettings, maintenanceMode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {savingSettings ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save All System Configurations</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: PUBLIC LOAN RECOVERY HOME PAGE CUSTOMIZER */}
      {/* ============================================================== */}
      {activeTab === 'homepage' && (
        <form onSubmit={handleSaveHomeConfig} className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                <Globe size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Public Home Page Editor (/)</h3>
                <p className="text-xs text-slate-500">
                  Customize the Loan Recovery, Payday Loans &amp; Micro Loans information shown to public visitors on your root domain.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
              >
                <ExternalLink size={14} />
                <span>Preview Live Home Page</span>
              </a>
              <button
                type="submit"
                disabled={savingHomeConfig}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                {savingHomeConfig ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Home Page</span>
              </button>
            </div>
          </div>

          {homeConfigMsg && (
            <div
              className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
                homeConfigMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <span>{homeConfigMsg.text}</span>
              <button type="button" onClick={() => setHomeConfigMsg(null)}>
                <X size={15} />
              </button>
            </div>
          )}

          {/* Brand Identity & Hero */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              1. Company Identity &amp; Hero Section
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Company Display Name</label>
                <input
                  type="text"
                  value={homeConfig.companyName}
                  onChange={(e) => setHomeConfig({ ...homeConfig, companyName: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tagline</label>
                <input
                  type="text"
                  value={homeConfig.tagline}
                  onChange={(e) => setHomeConfig({ ...homeConfig, tagline: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Brand Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={homeConfig.accentColor || '#0f766e'}
                    onChange={(e) => setHomeConfig({ ...homeConfig, accentColor: e.target.value })}
                    className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={homeConfig.accentColor || '#0f766e'}
                    onChange={(e) => setHomeConfig({ ...homeConfig, accentColor: e.target.value })}
                    className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Hero Eyebrow Label</label>
                <input
                  type="text"
                  value={homeConfig.heroEyebrow}
                  onChange={(e) => setHomeConfig({ ...homeConfig, heroEyebrow: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Hero Headline</label>
                <input
                  type="text"
                  value={homeConfig.heroHeadline}
                  onChange={(e) => setHomeConfig({ ...homeConfig, heroHeadline: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Hero Description</label>
              <textarea
                rows={2}
                value={homeConfig.heroSubheadline}
                onChange={(e) => setHomeConfig({ ...homeConfig, heroSubheadline: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">About Practice Title</label>
                <input
                  type="text"
                  value={homeConfig.aboutTitle}
                  onChange={(e) => setHomeConfig({ ...homeConfig, aboutTitle: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">About Recovery Practice Description</label>
                <textarea
                  rows={3}
                  value={homeConfig.aboutDescription}
                  onChange={(e) => setHomeConfig({ ...homeConfig, aboutDescription: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Payday Loans & Micro Loans Education */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payday Loans Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                2. Payday Loans Guide
              </h4>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Section Title</label>
                <input
                  type="text"
                  value={homeConfig.paydayLoansTitle}
                  onChange={(e) => setHomeConfig({ ...homeConfig, paydayLoansTitle: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Overview Summary</label>
                <textarea
                  rows={3}
                  value={homeConfig.paydayLoansSummary}
                  onChange={(e) => setHomeConfig({ ...homeConfig, paydayLoansSummary: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Key Points ({homeConfig.paydayLoansPoints.length})</label>
                  <button
                    type="button"
                    onClick={() =>
                      setHomeConfig({
                        ...homeConfig,
                        paydayLoansPoints: [...homeConfig.paydayLoansPoints, ''],
                      })
                    }
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Point
                  </button>
                </div>
                {homeConfig.paydayLoansPoints.map((pt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pt}
                      onChange={(e) => {
                        const next = [...homeConfig.paydayLoansPoints];
                        next[idx] = e.target.value;
                        setHomeConfig({ ...homeConfig, paydayLoansPoints: next });
                      }}
                      placeholder={`Payday loan key point #${idx + 1}`}
                      className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setHomeConfig({
                          ...homeConfig,
                          paydayLoansPoints: homeConfig.paydayLoansPoints.filter((_, i) => i !== idx),
                        })
                      }
                      className="p-2 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Micro Loans Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                3. Micro Loans Guide
              </h4>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Section Title</label>
                <input
                  type="text"
                  value={homeConfig.microLoansTitle}
                  onChange={(e) => setHomeConfig({ ...homeConfig, microLoansTitle: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Overview Summary</label>
                <textarea
                  rows={3}
                  value={homeConfig.microLoansSummary}
                  onChange={(e) => setHomeConfig({ ...homeConfig, microLoansSummary: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Key Points ({homeConfig.microLoansPoints.length})</label>
                  <button
                    type="button"
                    onClick={() =>
                      setHomeConfig({
                        ...homeConfig,
                        microLoansPoints: [...homeConfig.microLoansPoints, ''],
                      })
                    }
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Point
                  </button>
                </div>
                {homeConfig.microLoansPoints.map((pt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pt}
                      onChange={(e) => {
                        const next = [...homeConfig.microLoansPoints];
                        next[idx] = e.target.value;
                        setHomeConfig({ ...homeConfig, microLoansPoints: next });
                      }}
                      placeholder={`Micro loan key point #${idx + 1}`}
                      className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setHomeConfig({
                          ...homeConfig,
                          microLoansPoints: homeConfig.microLoansPoints.filter((_, i) => i !== idx),
                        })
                      }
                      className="p-2 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recovery Process Steps & Contact Footer */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                4. Loan Recovery Process &amp; Contact Information
              </h4>
              <button
                type="button"
                onClick={() =>
                  setHomeConfig({
                    ...homeConfig,
                    recoverySteps: [
                      ...homeConfig.recoverySteps,
                      { title: `${homeConfig.recoverySteps.length + 1}. New Step`, description: '' },
                    ],
                  })
                }
                className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
              >
                <Plus size={12} /> Add Step
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Recovery Section Title</label>
                <input
                  type="text"
                  value={homeConfig.recoveryTitle}
                  onChange={(e) => setHomeConfig({ ...homeConfig, recoveryTitle: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Recovery Section Subtitle</label>
                <input
                  type="text"
                  value={homeConfig.recoverySubtitle}
                  onChange={(e) => setHomeConfig({ ...homeConfig, recoverySubtitle: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {homeConfig.recoverySteps.map((step, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Step #{idx + 1}</span>
                    {homeConfig.recoverySteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setHomeConfig({
                            ...homeConfig,
                            recoverySteps: homeConfig.recoverySteps.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => {
                      const next = [...homeConfig.recoverySteps];
                      next[idx] = { ...next[idx], title: e.target.value };
                      setHomeConfig({ ...homeConfig, recoverySteps: next });
                    }}
                    placeholder="Step title"
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                  <textarea
                    rows={3}
                    value={step.description}
                    onChange={(e) => {
                      const next = [...homeConfig.recoverySteps];
                      next[idx] = { ...next[idx], description: e.target.value };
                      setHomeConfig({ ...homeConfig, recoverySteps: next });
                    }}
                    placeholder="Step description"
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Compliance &amp; Fair Practice Notice</label>
              <textarea
                rows={2}
                value={homeConfig.complianceNotice}
                onChange={(e) => setHomeConfig({ ...homeConfig, complianceNotice: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Support Email</label>
                <input
                  type="email"
                  value={homeConfig.contactEmail}
                  onChange={(e) => setHomeConfig({ ...homeConfig, contactEmail: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Helpline Phone</label>
                <input
                  type="text"
                  value={homeConfig.contactPhone}
                  onChange={(e) => setHomeConfig({ ...homeConfig, contactPhone: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Working Hours</label>
                <input
                  type="text"
                  value={homeConfig.workingHours}
                  onChange={(e) => setHomeConfig({ ...homeConfig, workingHours: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Office Address</label>
                <input
                  type="text"
                  value={homeConfig.officeAddress}
                  onChange={(e) => setHomeConfig({ ...homeConfig, officeAddress: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Footer Copyright</label>
                <input
                  type="text"
                  value={homeConfig.footerCopyright}
                  onChange={(e) => setHomeConfig({ ...homeConfig, footerCopyright: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingHomeConfig}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                {savingHomeConfig ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Publish Home Page Changes</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD TEAM MEMBER */}
      {/* ============================================================== */}
      {showAddTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users size={16} className="text-teal-600" />
                <span>Add Team Member &amp; Assign Permissions</span>
              </h3>
              <button
                onClick={() => setShowAddTeamModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {teamError && (
              <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{teamError}</span>
              </div>
            )}

            <form onSubmit={handleAddTeamMember} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                    placeholder="e.g. rohit_links"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Rohit Sharma"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    placeholder="rohit@example.com"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Min 6 characters"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Preset Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setNewRole(r);
                    setNewPermissions(getDefaultPermissionsForRole(r));
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500"
                >
                  <option value="link_creator">Only Link Creations (link_creator)</option>
                  <option value="template_designer">Only Template Designer (template_designer)</option>
                  <option value="manager">Manager (manager)</option>
                  <option value="admin">Admin (admin)</option>
                </select>
              </div>

              {/* Granular Permissions Checklist */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    Granular Access Permissions
                  </label>
                  <span className="text-[10px] text-slate-500">Only enabled features will show in sidebar</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {ALL_AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = newPermissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                          isChecked ? 'bg-teal-50/70 border-teal-200 text-teal-900' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewPermissions([...newPermissions, perm.id]);
                            } else {
                              setNewPermissions(newPermissions.filter((p) => p !== perm.id));
                            }
                          }}
                          className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                        />
                        <div className="min-w-0">
                          <span className="font-bold block text-[11px] leading-tight">{perm.label}</span>
                          <span className="text-[10px] text-slate-500 block leading-tight">{perm.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 2FA Enforced Checkbox */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Enforce Google Authenticator (TOTP)</span>
                  <span className="text-[11px] text-slate-500">Member will see QR code setup immediately upon first login</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTwoFactorRequired}
                    onChange={(e) => setNewTwoFactorRequired(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTeamModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teamActionLoading}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition"
                >
                  {teamActionLoading ? 'Creating...' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT TEAM MEMBER */}
      {/* ============================================================== */}
      {editMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Member Permissions: @{editMemberModal.username}
              </h3>
              <button
                onClick={() => setEditMemberModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Change Role
                </label>
                <select
                  value={editMemberRole}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setEditMemberRole(r);
                    setEditPermissions(getDefaultPermissionsForRole(r));
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500"
                >
                  <option value="link_creator">Only Link Creations (link_creator)</option>
                  <option value="template_designer">Only Template Designer (template_designer)</option>
                  <option value="manager">Manager (manager)</option>
                  <option value="admin">Admin (admin)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Reset Password (leave empty to keep current)
                </label>
                <input
                  type="password"
                  value={editMemberPassword}
                  onChange={(e) => setEditMemberPassword(e.target.value)}
                  placeholder="Enter new password (optional)"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Granular Permissions Checklist */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    Granular Access Permissions
                  </label>
                  <span className="text-[10px] text-slate-500">Unchecked items are hidden from member</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {ALL_AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = editPermissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                          isChecked ? 'bg-teal-50/70 border-teal-200 text-teal-900' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditPermissions([...editPermissions, perm.id]);
                            } else {
                              setEditPermissions(editPermissions.filter((p) => p !== perm.id));
                            }
                          }}
                          className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                        />
                        <div className="min-w-0">
                          <span className="font-bold block text-[11px] leading-tight">{perm.label}</span>
                          <span className="text-[10px] text-slate-500 block leading-tight">{perm.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 2FA Enforced Checkbox & Reset Button */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Require Google Authenticator</span>
                    <span className="text-[11px] text-slate-500">Enforces 2FA challenge on every login</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editTwoFactorRequired}
                      onChange={(e) => setEditTwoFactorRequired(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {editMemberModal.twoFactorEnabled && (
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] text-slate-600">Device already bound (TOTP active)</span>
                    <button
                      type="button"
                      onClick={() => handleReset2fa(editMemberModal)}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-800 underline"
                    >
                      Reset 2FA Secret
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditMemberModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateMemberRoleOrPassword}
                  disabled={teamActionLoading}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition"
                >
                  {teamActionLoading ? 'Saving...' : 'Save Member Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: AI PROMPT GENERATOR FOR NOTICE TEMPLATES */}
      {/* ============================================================== */}
      {showAiNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">AI Prompt for Notice Templates</h3>
                  <p className="text-[11px] text-slate-500">Copy & paste into ChatGPT, Gemini, or Claude</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiNoticeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all max-h-[300px] overflow-y-auto border border-slate-800">
                {aiNoticePromptText}
              </pre>
            </div>

            <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-teal-800 text-xs">
              💡 <b>Tip:</b> Tell AI the language (English, Hindi, Hinglish) and severity (Legal Notice, Polite Reminder, or Instant Settlement) to get tailor-made templates.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAiNoticeModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(aiNoticePromptText);
                  setCopiedAiPrompt(true);
                  setTimeout(() => setCopiedAiPrompt(false), 2000);
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-xs"
              >
                {copiedAiPrompt ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedAiPrompt ? 'Prompt Copied!' : 'Copy AI Prompt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Member Deep-Dive Activity Dossier Modal */}
      <TeamMemberDossierModal
        memberId={selectedDossierMemberId}
        isOpen={Boolean(selectedDossierMemberId)}
        onClose={() => setSelectedDossierMemberId(null)}
      />
    </div>
  );
};
