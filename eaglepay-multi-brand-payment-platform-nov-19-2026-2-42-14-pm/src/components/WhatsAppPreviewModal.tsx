import React, { useState } from 'react';
import {
  X,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Save,
  Image as ImageIcon,
  Share2,
} from 'lucide-react';
import { PaymentLink } from '../types/index.js';
import { api } from '../services/api.js';

interface WhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  link: PaymentLink;
  onUpdated?: () => void;
}

export const WhatsAppPreviewModal: React.FC<WhatsAppPreviewModalProps> = ({
  isOpen,
  onClose,
  link,
  onUpdated,
}) => {
  const [ogTitle, setOgTitle] = useState(
    link.ogTitle || `${link.brandName || 'Payment Portal'} - Official Payment Request`
  );
  const [ogDescription, setOgDescription] = useState(
    link.ogDescription ||
      `Pay ₹${link.amountFormatted} securely via UPI, Card, Net Banking. Customer: ${
        link.customerName || 'Valued Customer'
      }. Ref: ${link.merchantOrderNo}`
  );
  const [ogImage, setOgImage] = useState(
    link.ogImage ||
      link.brandLogo ||
      'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80'
  );
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  if (!isOpen) return null;

  const publicUrl = window.location.origin + (link.publicUrl || `/${link.brandSlug || 'pay'}/pay/${link.token}`);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePaymentLink(link.id, {
        ogTitle,
        ogDescription,
        ogImage,
      });
      if (onUpdated) onUpdated();
      alert('WhatsApp preview metadata updated successfully! Anyone sharing this link will see the new preview card.');
    } catch (err) {
      alert('Failed to update preview: ' + String(err));
    } finally {
      setSaving(false);
    }
  };

  const copyFullMessage = () => {
    const text = `*${ogTitle}*\n\nDear ${link.customerName || 'Customer'},\nPlease click the secure link below to complete your payment of ₹${link.amountFormatted}:\n\n🔗 ${publicUrl}\n\n_${ogDescription}_`;
    navigator.clipboard.writeText(text);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(
      `*${ogTitle}*\n\nDear ${link.customerName || 'Customer'},\nPlease complete your payment of ₹${link.amountFormatted} securely:\n\n${publicUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <MessageCircle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">WhatsApp &amp; Social Preview Editor</h3>
              <p className="text-[11px] text-emerald-300">
                Customize the preview card shown when sharing on WhatsApp, Telegram, and Facebook
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-emerald-300 hover:text-white hover:bg-emerald-900 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Live WhatsApp Chat Bubble Simulator */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sparkles size={13} className="text-emerald-600" />
              <span>Live WhatsApp Message Preview Simulator</span>
            </label>

            {/* WhatsApp Chat Background Frame */}
            <div className="bg-[#e5ddd5] p-4 rounded-2xl border border-slate-300 relative font-sans shadow-inner">
              <div className="max-w-sm ml-auto bg-[#dcf8c6] rounded-2xl rounded-tr-xs p-2 shadow-xs text-xs space-y-1.5 border border-[#c4e8ab]">
                <p className="text-slate-800 text-[11px] leading-relaxed">
                  Dear <span className="font-bold">{link.customerName || 'Customer'}</span>, please click the link below to pay ₹{link.amountFormatted}:
                </p>

                {/* WhatsApp Link Card Thumbnail Box */}
                <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                  {ogImage ? (
                    <img
                      src={ogImage}
                      alt="WhatsApp Preview"
                      className="w-full h-28 object-cover bg-slate-100"
                      onError={(e: any) => (e.target.style.display = 'none')}
                    />
                  ) : null}

                  <div className="p-2.5 space-y-0.5 bg-slate-50">
                    <div className="font-bold text-slate-900 text-xs line-clamp-1">
                      {ogTitle}
                    </div>
                    <div className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                      {ogDescription}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono pt-0.5 truncate">
                      {window.location.host}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-teal-800 font-mono underline break-all">
                  {publicUrl}
                </div>

                <div className="text-right text-[9px] text-slate-400 pt-0.5">
                  12:45 PM • Read ✓✓
                </div>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                WhatsApp Preview Title (og:title)
              </label>
              <input
                type="text"
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                placeholder="e.g. Samvit Loan Repayment - Invoice #991"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-teal-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                WhatsApp Preview Description (og:description)
              </label>
              <textarea
                rows={2}
                value={ogDescription}
                onChange={(e) => setOgDescription(e.target.value)}
                placeholder="Brief description seen under the title in WhatsApp..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-teal-600 font-medium resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                WhatsApp Preview Banner / Thumbnail Image URL (og:image)
              </label>
              <input
                type="text"
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="https://example.com/logo-or-banner.jpg"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-teal-600 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyFullMessage}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copiedMessage ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedMessage ? 'Copied Message' : 'Copy Formatted Text'}</span>
            </button>

            <button
              type="button"
              onClick={openWhatsApp}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Share2 size={14} />
              <span>Share to WhatsApp</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md ml-auto"
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save Preview'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
