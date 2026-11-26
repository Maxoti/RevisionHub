import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  Mail,
  Phone,
  ShieldCheck,
  ShoppingCart,
  X,
} from 'lucide-react';
import type { Paper } from '../types';
import { createPurchase, getPurchaseStatus, downloadUrl } from '../api';

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '254707244664';
const PHONE_REGEX = /^0[71]\d{8}$/;

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;
const MAX_POLL_ATTEMPTS = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

type Step = 'choose' | 'waiting' | 'success' | 'error';

interface Props {
  paper: Paper;
  onClose: () => void;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zM20.52 3.449A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

export default function BuyModalV2({ paper, onClose }: Props) {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('choose');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => stopPolling, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function stopPolling() {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function buildWhatsAppLink() {
    const text = encodeURIComponent(
      `I want to order ${paper.title} KES ${paper.price}. Paid to your till. Please send document.`
    );
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
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
      const { purchase_id } = await createPurchase(paper.id, phone, email || undefined);
      pollStatus(purchase_id);
    } catch (err) {
      if (isNetworkError(err)) {
        finish(
          'error',
          `We couldn't confirm your request went through. If you get an M-Pesa prompt, complete it — ` +
            `your download link will still be sent to WhatsApp${email ? ' and email.' : '.'}`
        );
      } else {
        finish('error', extractError(err));
      }
    }
  }

  function pollStatus(purchaseId: number) {
    let attempts = 0;

    pollRef.current = window.setInterval(async () => {
      attempts++;

      if (attempts > MAX_POLL_ATTEMPTS) {
        finish('error', 'Payment timed out. If you paid, contact us via WhatsApp.');
        return;
      }

      let data;
      try {
        data = await getPurchaseStatus(purchaseId);
      } catch (err) {
        console.warn('[BuyModal] poll attempt failed:', err);
        return; // transient — keep polling until timeout
      }

      if (data.status === 'completed') {
        if (data.download_token) {
          stopPolling();
          setLoading(false);
          setDownloadToken(data.download_token);
          setStep('success');
        } else {
          finish('error', 'This link has already been used or has expired. Contact us via WhatsApp for help.');
        }
        return;
      }

      if (data.status === 'failed') {
        finish('error', 'Payment was not completed. Please try again.');
      }
      // status === 'pending' → keep polling
    }, POLL_INTERVAL_MS);
  }

  function retry() {
    stopPolling();
    setLoading(false);
    setErrorMsg('');
    setStep('choose');
  }

  const termLabel = /^\d+$/.test(String(paper.term)) ? `Term ${paper.term}` : paper.term;
  const details = [paper.exam_type, termLabel, paper.subject].filter(Boolean).join(' • ');

  const inputClass =
    'w-full rounded-xl border border-[#0B2A7A]/15 bg-white py-3 pl-10 pr-3 text-sm text-[#0B2A7A] placeholder:text-[#0B2A7A]/40 focus:border-[#1A56DB] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/25';
  const labelClass = 'mb-1.5 flex items-center gap-2 text-sm font-bold text-[#0B2A7A]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0B2A7A]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-title"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl md:grid md:max-w-3xl md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-[#0B2A7A]/60 transition hover:bg-[#0B2A7A]/10 hover:text-[#0B2A7A]"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Left: what you are buying */}
        <aside className="flex flex-col gap-4 bg-[#F3F7FF] p-6 pr-14 md:p-8 md:pr-8">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#E3ECFF] px-3 py-1.5 text-xs font-bold tracking-wide text-[#1A56DB]">
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            ORDER
          </span>

          <h2 id="buy-title" className="text-xl font-bold leading-snug text-[#0B2A7A] md:text-2xl">
            {paper.title}
          </h2>

          {details && <p className="text-sm text-[#0B2A7A]/70">{details}</p>}

          <span className="w-fit rounded-lg bg-[#19C45F] px-4 py-1.5 text-xl font-extrabold text-white shadow-sm">
            KES {paper.price}
          </span>

          <ol className="mt-2 hidden space-y-3 text-sm text-[#0B2A7A]/80 md:block">
            <li className="flex items-start gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1A56DB] text-xs font-bold text-white">1</span>
              Enter your M-Pesa phone number.
            </li>
            <li className="flex items-start gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1A56DB] text-xs font-bold text-white">2</span>
              Approve the payment prompt on your phone.
            </li>
            <li className="flex items-start gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1A56DB] text-xs font-bold text-white">3</span>
              Download your paper straight away.
            </li>
          </ol>
        </aside>

        {/* Right: pay */}
        <section className="p-6 md:flex md:flex-col md:justify-center md:p-8">
          {step === 'choose' && (
            <div>
              <label htmlFor="buy-phone" className={labelClass}>
                <Phone className="h-4 w-4" aria-hidden="true" />
                M-Pesa phone number <span className="text-red-500">*</span>
              </label>
              <div className="relative mb-4">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0B2A7A]/40" aria-hidden="true" />
                <input
                  id="buy-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') startPurchase();
                  }}
                  placeholder="07XXXXXXXX"
                  className={inputClass}
                />
              </div>

              <label htmlFor="buy-email" className={labelClass}>
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email <span className="font-normal text-[#0B2A7A]/60">(optional)</span>
              </label>
              <div className="relative mb-5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0B2A7A]/40" aria-hidden="true" />
                <input
                  id="buy-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>

              <button
                type="button"
                onClick={startPurchase}
                disabled={loading}
                className="flex w-full items-stretch overflow-hidden rounded-full bg-gradient-to-b from-[#1A56DB] to-[#123FA6] text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex w-28 items-center justify-center text-sm font-extrabold tracking-wide">M-PESA</span>
                <span className="my-3 w-px bg-white/30" aria-hidden="true" />
                <span className="flex flex-1 items-center justify-between px-5 py-3.5 font-semibold">
                  {loading ? 'Sending prompt...' : 'Pay with M-Pesa'}
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </span>
              </button>

              <div className="my-3 flex items-center gap-3 text-xs text-[#0B2A7A]/50">
                <span className="h-px flex-1 bg-[#0B2A7A]/15" />
                or
                <span className="h-px flex-1 bg-[#0B2A7A]/15" />
              </div>

              <a
                href={buildWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-stretch overflow-hidden rounded-full bg-gradient-to-b from-[#25D366] to-[#128C4A] text-white shadow-md transition hover:brightness-105"
              >
                <span className="flex w-28 items-center justify-center">
                  <WhatsAppIcon className="h-7 w-7" />
                </span>
                <span className="my-3 w-px bg-white/30" aria-hidden="true" />
                <span className="flex flex-1 items-center justify-between px-5 py-3.5 font-semibold">
                  Order via WhatsApp
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </span>
              </a>

              <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#F3F7FF] px-3 py-2.5 text-xs text-[#0B2A7A]/80">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#1A56DB]" aria-hidden="true" />
                Your payment is secure and processed instantly.
              </p>
            </div>
          )}

          {step === 'waiting' && (
            <div className="py-6 text-center" role="status" aria-live="polite">
              <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B2A7A]/15 border-t-[#1A56DB]" />
              <p className="text-base font-semibold text-[#0B2A7A]">Check your phone</p>
              <p className="mt-1 text-sm text-[#0B2A7A]/70">Enter your M-Pesa PIN to complete the payment.</p>
            </div>
          )}

          {step === 'success' && downloadToken && (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-[#19C45F]" aria-hidden="true" />
              <p className="mb-5 text-lg font-bold text-[#0B2A7A]">Payment confirmed!</p>
              <a
                href={downloadUrl(downloadToken)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#1A56DB] to-[#123FA6] py-3.5 font-semibold text-white shadow-md transition hover:brightness-110"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
                Download Now
              </a>
              <p className="mt-3 text-xs text-[#0B2A7A]/60">Link expires in 15 minutes.</p>
            </div>
          )}

          {step === 'error' && (
            <div className="py-4 text-center" role="alert">
              <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-500" aria-hidden="true" />
              <p className="mb-5 text-sm text-red-600">{errorMsg}</p>
              <button
                type="button"
                onClick={retry}
                className="w-full rounded-full bg-[#E8EEFB] py-3 font-semibold text-[#0B2A7A] transition hover:bg-[#dbe5f8]"
              >
                Try Again
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function isNetworkError(err: unknown): boolean {
  // fetch() throws a plain TypeError ("Failed to fetch") when the request
  // never completed — no response, no body, nothing to parse. Any error
  // that made it back from api.ts as an Error with a message came from a
  // response the server actually sent.
  return err instanceof TypeError;
}

function extractError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Could not start payment. Try again.';
}