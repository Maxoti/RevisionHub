import { useEffect, useRef, useState } from 'react';
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="relative bg-white rounded-sm shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl"
          aria-label="Close"
        >
          &times;
        </button>

        <p className="font-mono text-[10px] uppercase tracking-wide text-gray-400 mb-1">Order</p>
        <h2 className="text-lg font-semibold text-chalkboard leading-snug mb-1">{paper.title}</h2>
        <p className="font-mono text-stamp font-semibold mb-4">KES {paper.price}</p>

        {step === 'choose' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              M-Pesa phone number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              className="w-full border border-gray-200 rounded px-3 py-2 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            <button
              onClick={startPurchase}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-full mb-2 transition-all shadow-md"
            >
              {loading ? 'Sending prompt...' : 'Pay with M-Pesa'}
            </button>

            {whatsappNumber && (
              <>
                <p className="text-center text-xs text-gray-400 my-2">or</p>
                <a
                  href={buildWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-full shadow-md"
                >
                  Order via WhatsApp
                </a>
              </>
            )}
          </div>
        )}

        {step === 'waiting' && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-700 mb-4">Check your phone and enter your M-Pesa PIN...</p>
            <div className="mx-auto w-8 h-8 border-[3px] border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}

        {step === 'success' && downloadToken && (
          <div className="text-center py-2">
            <div className="text-3xl mb-3">&#10003;</div>
            <p className="text-sm font-medium text-gray-700 mb-1">Payment confirmed!</p>
            <a
              href={storeDownloadUrl(slug, downloadToken)}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-full transition-colors"
            >
              Download Now
            </a>
            <p className="text-xs text-gray-400 mt-2">Link expires in 15 minutes.</p>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-2">
            <p className="text-sm text-red-500 mb-4">{errorMsg}</p>
            <button
              onClick={retry}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}