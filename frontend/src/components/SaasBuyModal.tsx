import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Mail, Phone, ShieldCheck, ShoppingCart, X } from 'lucide-react';
import type { Paper } from '../types';
import {
  createStorePurchase,
  getStorePurchaseStatus,
  storeDownloadUrl,
  extractApiError,
  isNetworkError,
} from '../saas.api';

const PHONE_REGEX = /^0[71]\d{8}$/;

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;
const MAX_POLL_ATTEMPTS = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

type Step = 'choose' | 'waiting' | 'success' | 'error';

interface Props {
  paper: Paper;
  slug: string; // the store this paper belongs to, e.g. "maxwel-onyango"
  whatsappNumber?: string; // the SELLER's number (254...), not the platform's
  onClose: () => void;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function SaasBuyModal({ paper, slug, whatsappNumber, onClose }: Props) {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('choose');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => stopPolling, []);

  function stopPolling() {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function buildWhatsAppLink() {
    const digits = (whatsappNumber || '').replace(/\D/g, '');
    const text = encodeURIComponent(
      `I want to order ${paper.title} KES ${paper.price}. Paid to your till. Please send document.`
    );
    return `https://wa.me/${digits}?text=${text}`;
  }

  function finish(next: Step, message = '') {
    stopPolling();
    setLoading(false);
    setErrorMsg(message);
    setStep(next);
  }

  async function startPurchase() {
    if (loading) return;

    if (!PHONE_REGEX.test(phone)) {
      setErrorMsg('Enter a valid Safaricom number e.g. 07XXXXXXXX');
      setStep('error');
      return;
    }

    setLoading(true);
    setStep('waiting');

    try {
      const { purchase_id } = await createStorePurchase(slug, paper.id, phone, email || undefined);
      pollStatus(purchase_id);
    } catch (err) {
      if (isNetworkError(err)) {
        finish(
          'error',
          `We couldn't confirm your request went through. If you get an M-Pesa prompt, complete it, ` +
            `then try again in a minute to get your download.`
        );
      } else {
        finish('error', extractApiError(err));
      }
    }
  }

  function pollStatus(purchaseId: string) {
    let attempts = 0;

    pollRef.current = window.setInterval(async () => {
      attempts++;

      if (attempts > MAX_POLL_ATTEMPTS) {
        finish('error', 'Payment timed out. If you paid, contact the store owner.');
        return;
      }

      let data;
      try {
        data = await getStorePurchaseStatus(purchaseId);
      } catch (err) {
        console.warn('[SaasBuyModal] poll attempt failed:', err);
        return; // transient, keep polling until timeout
      }

      if (data.status === 'completed') {
        if (data.download_token) {
          stopPolling();
          setLoading(false);
          setDownloadToken(data.download_token);
          setStep('success');
        } else {
          finish('error', 'This link has already been used or has expired. Contact the store owner for help.');
        }
        return;
      }

      if (data.status === 'failed') {
        finish('error', 'Payment was not completed. Please try again.');
      }
      // status === 'pending' -> keep polling
    }, POLL_INTERVAL_MS);
  }

  function retry() {
    stopPolling();
    setLoading(false);
    setErrorMsg('');
    setStep('choose');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F5C]/60 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Order"
      >
        {/* Top row: ORDER tag + close */}
        <div className="mb-3 flex items-start justify-between sm:mb-4">
          <span className="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-blue-700">
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            Order
          </span>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <h2 className="mb-2 text-xl font-extrabold leading-tight text-[#0B2A7A] sm:mb-3 sm:text-2xl">{paper.title}</h2>
        <p className="mb-4 inline-block rounded-lg bg-gradient-to-b from-green-500 to-green-600 px-3 py-1 text-xl font-extrabold text-white shadow-sm sm:mb-5 sm:px-4 sm:py-1.5 sm:text-2xl">
          KES {paper.price}
        </p>

        {step === 'choose' && (
          <div>
            <label
              htmlFor="saas-buy-phone"
              className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#0B2A7A] sm:mb-1.5 sm:text-base"
            >
              <Phone className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <span>
                M-Pesa phone number <span className="text-red-500">*</span>
              </span>
            </label>
            <div className="relative mb-3 sm:mb-4">
              <Phone
                className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="saas-buy-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-11 pr-3 text-base sm:py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <label
              htmlFor="saas-buy-email"
              className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#0B2A7A] sm:mb-1.5 sm:text-base"
            >
              <Mail className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <span>
                Email <span className="font-normal text-slate-500">(optional)</span>
              </span>
            </label>
            <div className="relative mb-4 sm:mb-5">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="saas-buy-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-11 pr-3 text-base sm:py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              onClick={startPurchase}
              disabled={loading}
              className="flex w-full items-center rounded-full bg-gradient-to-b from-[#1747E0] to-[#0B34B8] px-5 py-3 sm:py-3.5 text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6"
            >
              <span className="w-[4.5rem] whitespace-nowrap text-left text-base font-extrabold tracking-tight sm:w-24 sm:text-lg">M-PESA</span>
              <span className="mx-3 h-8 w-px bg-white/40" aria-hidden="true" />
              <span className="flex-1 whitespace-nowrap text-center text-base font-bold sm:text-lg">
                {loading ? 'Sending prompt...' : 'Pay with M-Pesa'}
              </span>
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>

            {whatsappNumber && (
              <>
                <div className="my-3 flex items-center gap-4 text-sm text-slate-500 sm:my-4">
                  <span className="h-px flex-1 bg-slate-200" />
                  or
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <a
                  href={buildWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center rounded-full bg-gradient-to-b from-green-500 to-green-600 px-5 py-3 sm:py-3.5 text-white shadow-md transition hover:brightness-110 sm:px-6"
                >
                  <WhatsAppIcon className="h-8 w-10 shrink-0 sm:w-24 sm:pr-12" />
                  <span className="mx-2 h-8 w-px bg-white/40 sm:mx-3" aria-hidden="true" />
                  <span className="flex-1 whitespace-nowrap text-center text-[15px] font-bold sm:text-lg">Order via WhatsApp</span>
                  <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </a>
              </>
            )}

            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900 sm:mt-5 sm:px-4 sm:py-3 sm:text-sm">
              <ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
              Your payment is secure and processed instantly.
            </div>
          </div>
        )}

        {step === 'waiting' && (
          <div className="py-4 text-center">
            <p className="mb-4 text-sm text-slate-700">Check your phone and enter your M-Pesa PIN...</p>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
          </div>
        )}

        {step === 'success' && downloadToken && (
          <div className="py-2 text-center">
            <div className="mb-3 text-3xl text-green-600">&#10003;</div>
            <p className="mb-3 text-sm font-medium text-slate-700">Payment confirmed!</p>
            <a
              href={storeDownloadUrl(slug, downloadToken)}
              className="block w-full rounded-full bg-gradient-to-b from-[#1747E0] to-[#0B34B8] py-3 text-lg font-bold text-white shadow-md transition hover:brightness-110"
            >
              Download Now
            </a>
            <p className="mt-2 text-xs text-slate-500">Link expires in 15 minutes.</p>
          </div>
        )}

        {step === 'error' && (
          <div className="py-2 text-center">
            <p className="mb-4 text-sm text-red-600">{errorMsg}</p>
            <button
              onClick={retry}
              className="w-full rounded-full bg-slate-100 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}