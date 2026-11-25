import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  QrCode,
  KeyRound,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import QRCode from 'qrcode';
import { api, setAuthToken } from '../services/api.js';
import { AdminUser } from '../types/index.js';

interface LoginPageProps {
  onSuccess: (user: AdminUser) => void;
}

type LoginStep = 'CREDENTIALS' | '2FA_CHALLENGE' | '2FA_ENROLL';

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [step, setStep] = useState<LoginStep>('CREDENTIALS');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA state
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isSuperKeyMode, setIsSuperKeyMode] = useState(false);

  // 2FA First-time setup state
  const [setupSecret, setSetupSecret] = useState('');
  const [setupQrUrl, setSetupQrUrl] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide your username/email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.login(username.trim(), password);

      if (res.requires2fa) {
        setTempToken(res.tempToken);
        setStep('2FA_CHALLENGE');
        setTwoFactorCode('');
        setError(null);
        return;
      }

      if (res.requiresSetup2fa) {
        setTempToken(res.tempToken);
        setSetupSecret(res.secret);

        // Generate QR code data URL
        try {
          const qrDataUrl = await QRCode.toDataURL(res.otpAuthUrl, {
            width: 200,
            margin: 1,
            color: { dark: '#020617', light: '#ffffff' },
          });
          setSetupQrUrl(qrDataUrl);
        } catch {
          setSetupQrUrl('');
        }

        setStep('2FA_ENROLL');
        setTwoFactorCode('');
        setError(null);
        return;
      }

      if (res.success && res.token && res.user) {
        setAuthToken(res.token);
        onSuccess(res.user);
      } else {
        setError(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid username/email or password');
    } finally {
      setLoading(false);
    }
  };

  const handle2faVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode.trim()) {
      setError(isSuperKeyMode ? 'Please enter the Master Super Key.' : 'Please enter the 6-digit Authenticator code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.login2fa(tempToken, twoFactorCode.trim());
      if (res.success && res.token && res.user) {
        setAuthToken(res.token);
        onSuccess(res.user);
      } else {
        setError(res.error || 'Verification code failed. Please check your Authenticator app.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code or emergency bypass key');
    } finally {
      setLoading(false);
    }
  };

  const handle2faBindSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode.trim()) {
      setError('Please enter the 6-digit code shown in your Authenticator app.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.bind2fa(tempToken, setupSecret, twoFactorCode.trim());
      if (res.success && res.token && res.user) {
        setAuthToken(res.token);
        onSuccess(res.user);
      } else {
        setError(res.error || 'Verification failed. Please check the code.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const copySecretToClipboard = () => {
    if (!setupSecret) return;
    navigator.clipboard.writeText(setupSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const resetToCredentials = () => {
    setStep('CREDENTIALS');
    setTempToken('');
    setTwoFactorCode('');
    setError(null);
    setIsSuperKeyMode(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 antialiased selection:bg-teal-500 selection:text-slate-950">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-lg shadow-xl shadow-teal-500/10 mx-auto tracking-tight">
            AS
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">AppAssistServices</h1>
          <p className="text-xs text-slate-400">Administrative &amp; Merchant Operations Portal</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-5">

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: USERNAME & PASSWORD                                              */}
          {/* ========================================================================= */}
          {step === 'CREDENTIALS' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username or Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User size={15} />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-teal-500 font-medium"
                    placeholder="Enter your administrative username or email"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-slate-400 hover:text-teal-400 flex items-center gap-1 transition"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock size={15} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-teal-500 font-medium"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Portal</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: 2FA CHALLENGE (Google Authenticator Code or Super Master Key)     */}
          {/* ========================================================================= */}
          {step === '2FA_CHALLENGE' && (
            <form onSubmit={handle2faVerifySubmit} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-2">
                  {isSuperKeyMode ? <KeyRound size={20} /> : <Lock size={20} />}
                </div>
                <h3 className="text-sm font-bold text-white">
                  {isSuperKeyMode ? 'Emergency Master Bypass Key' : 'Two-Factor Authentication'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isSuperKeyMode
                    ? 'Enter the system Master Super Key configured by Super Admin to bypass TOTP.'
                    : 'Open Google Authenticator on your phone and enter the 6-digit verification code.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isSuperKeyMode ? 'Master Super Bypass Key' : '6-Digit Authenticator Code'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={isSuperKeyMode ? 40 : 8}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.trim())}
                  className={`w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-teal-500 font-mono text-center tracking-widest ${
                    isSuperKeyMode ? 'text-sm' : 'text-xl font-bold'
                  }`}
                  placeholder={isSuperKeyMode ? 'SUPER-MASTER-KEY' : '••••••'}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsSuperKeyMode(!isSuperKeyMode);
                    setTwoFactorCode('');
                    setError(null);
                  }}
                  className="text-teal-400 hover:text-teal-300 font-medium underline underline-offset-2"
                >
                  {isSuperKeyMode ? '← Use Google Authenticator' : 'Lost Phone? Use Master Super Key'}
                </button>

                <button
                  type="button"
                  onClick={resetToCredentials}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <ArrowLeft size={12} />
                  <span>Back</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Sign In</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: FIRST-TIME 2FA ENROLLMENT (QR Code & Secret)                      */}
          {/* ========================================================================= */}
          {step === '2FA_ENROLL' && (
            <form onSubmit={handle2faBindSubmit} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-2">
                  <QrCode size={20} />
                </div>
                <h3 className="text-sm font-bold text-white">Bind Google Authenticator</h3>
                <p className="text-xs text-slate-400">
                  Scan this QR code with Google Authenticator or Microsoft Authenticator app on your smartphone.
                </p>
              </div>

              {/* QR Code Container */}
              {setupQrUrl && (
                <div className="flex justify-center p-3 bg-white rounded-2xl w-fit mx-auto shadow-md">
                  <img src={setupQrUrl} alt="Google Authenticator QR Code" className="w-40 h-40 object-contain" />
                </div>
              )}

              {/* Manual Secret Key */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">Or enter setup key manually:</span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs font-mono text-teal-400 font-bold tracking-wider select-all truncate">
                    {setupSecret}
                  </code>
                  <button
                    type="button"
                    onClick={copySecretToClipboard}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
                    title="Copy Secret"
                  >
                    {copiedSecret ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm 6-Digit Code from App
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.trim())}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-teal-500 font-mono text-center text-lg tracking-widest font-bold"
                  placeholder="••••••"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={resetToCredentials}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <ArrowLeft size={12} />
                  <span>Back to login</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Binding Device...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Complete Setup</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} AppAssistServices. All rights reserved.
        </div>
      </div>
    </div>
  );
};
