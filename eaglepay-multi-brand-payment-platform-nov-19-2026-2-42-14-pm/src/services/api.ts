const TOKEN_KEY = 'eaglepay_admin_token';
const USER_KEY = 'eaglepay_admin_user';

export function getAuthToken(): string | null {
  const local = localStorage.getItem(TOKEN_KEY);
  if (local) return local;

  // Check cookie fallback
  const match = document.cookie.match(/(?:^|;\s*)eaglepay_admin_token=([^;]+)/);
  if (match) {
    const cookieToken = decodeURIComponent(match[1]);
    localStorage.setItem(TOKEN_KEY, cookieToken);
    return cookieToken;
  }
  return null;
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  try {
    document.cookie = `eaglepay_admin_token=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
    document.cookie = `eaglepay_token=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {}
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  try {
    document.cookie = 'eaglepay_admin_token=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'eaglepay_token=; path=/; max-age=0; SameSite=Lax';
  } catch {}
}

export function getCachedUser(): any | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: any): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    clearAuthToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  const data = await response.json().catch(() => ({ success: false, error: 'Non-JSON response' }));

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login2fa: (tempToken: string, code: string) =>
    apiRequest('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ tempToken, code }) }),
  bind2fa: (tempToken: string, secret: string, code: string) =>
    apiRequest('/api/auth/2fa/bind', { method: 'POST', body: JSON.stringify({ tempToken, secret, code }) }),
  getMe: () => apiRequest('/api/auth/me'),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),

  // Dashboard
  getDashboardStats: (teamMemberId?: string) =>
    apiRequest(`/api/dashboard/stats${teamMemberId && teamMemberId !== 'ALL' ? `?teamMemberId=${encodeURIComponent(teamMemberId)}` : ''}`),

  // Customers
  getCustomers: (params?: string | { search?: string; createdByAdminId?: string }) => {
    if (typeof params === 'string') {
      return apiRequest(`/api/customers${params ? `?search=${encodeURIComponent(params)}` : ''}`);
    }
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.createdByAdminId && params.createdByAdminId !== 'ALL') q.set('createdByAdminId', params.createdByAdminId);
    return apiRequest(`/api/customers?${q.toString()}`);
  },
  getCustomer: (id: string) => apiRequest(`/api/customers/${id}`),
  createCustomer: (data: any) => apiRequest('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: any) =>
    apiRequest(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) =>
    apiRequest(`/api/customers/${id}`, { method: 'DELETE' }),
  bulkDeleteCustomers: (ids: string[]) =>
    apiRequest('/api/customers/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),

  // Payment Links
  getPaymentLinks: (params: {
    status?: string;
    brandId?: string;
    search?: string;
    createdByAdminId?: string;
    datePreset?: string;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.status && params.status !== 'ALL') q.set('status', params.status);
    if (params.brandId && params.brandId !== 'ALL') q.set('brandId', params.brandId);
    if (params.search) q.set('search', params.search);
    if (params.createdByAdminId && params.createdByAdminId !== 'ALL') q.set('createdByAdminId', params.createdByAdminId);
    if (params.datePreset && params.datePreset !== 'all') q.set('datePreset', params.datePreset);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
    return apiRequest(`/api/payment-links?${q.toString()}`);
  },
  getPaymentLink: (id: string) => apiRequest(`/api/payment-links/${id}`),
  createPaymentLink: (data: any) =>
    apiRequest('/api/payment-links', { method: 'POST', body: JSON.stringify(data) }),
  updatePaymentLink: (id: string, data: any) =>
    apiRequest(`/api/payment-links/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePaymentLink: (id: string) =>
    apiRequest(`/api/payment-links/${id}`, { method: 'DELETE' }),
  bulkDeletePaymentLinks: (ids: string[]) =>
    apiRequest('/api/payment-links/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  togglePaymentLink: (id: string) =>
    apiRequest(`/api/payment-links/${id}/toggle`, { method: 'PATCH' }),
  recheckPaymentLink: (id: string) =>
    apiRequest(`/api/payment-links/${id}/recheck`, { method: 'POST' }),
  getPaymentLinkTracking: (id: string) =>
    apiRequest(`/api/payment-links/${id}/tracking`),
  verifyManualPayment: (
    id: string,
    data: { action: 'approve' | 'reject'; note?: string; utrNumber?: string }
  ) =>
    apiRequest(`/api/payment-links/${id}/manual-verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Brands & Templates
  getBrands: () => apiRequest('/api/brands'),
  createBrand: (data: any) => apiRequest('/api/brands', { method: 'POST', body: JSON.stringify(data) }),
  updateBrand: (id: string, data: any) => apiRequest(`/api/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getBrandTemplate: (brandId: string) => apiRequest(`/api/brands/${brandId}/template`),
  updateBrandTemplate: (brandId: string, htmlContent: string, changeNotes?: string) =>
    apiRequest(`/api/brands/${brandId}/template`, {
      method: 'PUT',
      body: JSON.stringify({ htmlContent, changeNotes }),
    }),
  getTemplateVariables: () => apiRequest('/api/brands/templates/variables'),
  previewTemplate: (htmlContent: string, brandId?: string) =>
    apiRequest('/api/brands/templates/preview', {
      method: 'POST',
      body: JSON.stringify({ htmlContent, brandId }),
    }),

  // Gateway Accounts
  getGatewayAccounts: () => apiRequest('/api/gateway-accounts'),
  createGatewayAccount: (data: any) =>
    apiRequest('/api/gateway-accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateGatewayAccount: (id: string, data: any) =>
    apiRequest(`/api/gateway-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  testGatewayAccount: (id: string) =>
    apiRequest(`/api/gateway-accounts/${id}/test`, { method: 'POST' }),

  // Webhooks
  getWebhookLogs: () => apiRequest('/api/webhooks/logs'),
  simulateWebhook: (data: any) =>
    apiRequest('/api/webhooks/simulate', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getReportSummary: () => apiRequest('/api/reports/summary'),
  getTeamMemberDossier: (memberId: string) => apiRequest(`/api/reports/team-member/${memberId}/dossier`),

  // Audit Logs
  getAuditLogs: (params?: string | {
    search?: string;
    action?: string;
    entityType?: string;
    adminId?: string;
    datePreset?: string;
  }) => {
    if (typeof params === 'string') {
      return apiRequest(`/api/audit-logs${params ? `?search=${encodeURIComponent(params)}` : ''}`);
    }
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.action && params.action !== 'ALL') q.set('action', params.action);
    if (params?.entityType && params.entityType !== 'ALL') q.set('entityType', params.entityType);
    if (params?.adminId && params.adminId !== 'ALL') q.set('adminId', params.adminId);
    if (params?.datePreset && params.datePreset !== 'all') q.set('datePreset', params.datePreset);
    return apiRequest(`/api/audit-logs?${q.toString()}`);
  },

  // Tests
  runTests: () => apiRequest('/api/tests/run', { method: 'POST' }),

  // System & Settings
  getHealth: () => apiRequest('/api/system/health'),
  getSettings: () => apiRequest('/api/system/settings'),
  updateSettings: (data: any) => apiRequest('/api/system/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getMaintenanceStats: () => apiRequest('/api/system/maintenance/stats'),
  pruneExpiredData: () => apiRequest('/api/system/maintenance/prune', { method: 'POST' }),
  rotateSuperKey: (newKey?: string) =>
    apiRequest('/api/system/security/rotate-super-key', { method: 'POST', body: JSON.stringify({ newKey }) }),

  // Auth, Profile & Password
  changePassword: (data: { currentPassword?: string; newPassword: string }) =>
    apiRequest('/api/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data: { username?: string; email?: string; name?: string }) =>
    apiRequest('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Team Management
  getTeamMembers: () => apiRequest('/api/auth/team'),
  createTeamMember: (data: any) =>
    apiRequest('/api/auth/team', { method: 'POST', body: JSON.stringify(data) }),
  updateTeamMember: (id: string, data: any) =>
    apiRequest(`/api/auth/team/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeamMember: (id: string) =>
    apiRequest(`/api/auth/team/${id}`, { method: 'DELETE' }),
  resetTeam2fa: (id: string) =>
    apiRequest(`/api/auth/team/${id}/reset-2fa`, { method: 'POST' }),

  // Notice Templates
  getNoticeTemplates: () => apiRequest('/api/notice-templates'),
  createNoticeTemplate: (data: any) =>
    apiRequest('/api/notice-templates', { method: 'POST', body: JSON.stringify(data) }),
  updateNoticeTemplate: (id: string, data: any) =>
    apiRequest(`/api/notice-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNoticeTemplate: (id: string) =>
    apiRequest(`/api/notice-templates/${id}`, { method: 'DELETE' }),
  renderNoticeTemplate: (data: { templateId?: string; customContent?: string; paymentLinkId: string }) =>
    apiRequest('/api/notice-templates/render', { method: 'POST', body: JSON.stringify(data) }),

  // Public Checkout & Public Home
  getPublicHome: () => apiRequest('/api/public/home'),
  getPublicCheckout: (token: string) => apiRequest(`/api/public/checkout/${token}`),
  initiatePublicPay: (token: string) =>
    apiRequest(`/api/public/checkout/${token}/pay`, { method: 'POST' }),
  checkPublicStatus: (token: string) =>
    apiRequest(`/api/public/checkout/${token}/check-status`, { method: 'POST' }),
  submitManualPaymentProof: (
    token: string,
    data: { utrNumber?: string; screenshotDataUrl?: string; payerNote?: string }
  ) =>
    apiRequest(`/api/public/checkout/${token}/manual-submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Bulk Export & Import for Payment Links Migration
  downloadPaymentLinksExport: async (
    format: 'json' | 'csv',
    params: {
      status?: string;
      brandId?: string;
      search?: string;
      createdByAdminId?: string;
      datePreset?: string;
      startDate?: string;
      endDate?: string;
      ids?: string;
    } = {}
  ) => {
    const q = new URLSearchParams();
    if (params.status && params.status !== 'ALL') q.set('status', params.status);
    if (params.brandId && params.brandId !== 'ALL') q.set('brandId', params.brandId);
    if (params.search) q.set('search', params.search);
    if (params.createdByAdminId && params.createdByAdminId !== 'ALL') q.set('createdByAdminId', params.createdByAdminId);
    if (params.datePreset && params.datePreset !== 'all') q.set('datePreset', params.datePreset);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
    if (params.ids) q.set('ids', params.ids);

    const token = getAuthToken();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const endpoint = `/api/payment-links/export/${format}?${q.toString()}`;
    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Export failed (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const fallbackName =
      format === 'json'
        ? `payment-links-backup-${new Date().toISOString().slice(0, 10)}.json`
        : `payment_links_export_${new Date().toISOString().slice(0, 10)}.csv`;
    const filename = match ? match[1] : fallbackName;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { success: true, filename };
  },
  importPaymentLinks: (payload: {
    links: any[];
    duplicateStrategy?: 'skip' | 'overwrite';
    brandMode?: 'match' | 'override';
    targetBrandId?: string;
    gatewayMode?: 'match' | 'override';
    targetGatewayAccountId?: string;
    extendExpiryHours?: number;
  }) =>
    apiRequest('/api/payment-links/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
