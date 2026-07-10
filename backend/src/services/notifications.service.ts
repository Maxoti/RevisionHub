import axios from 'axios';

// ─── Types ───────────────────────────────────────────────────────
interface EmailParams {
  to: string | null;
  paperTitle: string;
  downloadUrl: string;
}

interface WhatsAppParams {
  phone: string;
  paperTitle: string;
  downloadUrl: string;
}

interface NotifyBuyerParams {
  phone: string;
  email: string | null;
  paperTitle: string;
  downloadUrl: string;
}

// ─── Email via Resend ────────────────────────────────────────────
async function sendEmailNotification({ to, paperTitle, downloadUrl }: EmailParams): Promise<void> {
  if (!process.env.RESEND_API_KEY || !to) return;

  const FROM = process.env.EMAIL_FROM || 'papers@yourdomain.co.ke';

  await axios.post(
    'https://api.resend.com/emails',
    {
      from: FROM,
      to: [to],
      subject: `Your download is ready — ${paperTitle}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#16302A">Payment confirmed ✓</h2>
          <p>Thank you for your purchase. Your exam paper is ready to download.</p>
          <p style="margin:8px 0"><strong>${paperTitle}</strong></p>
          <a href="${downloadUrl}"
             style="display:inline-block;margin-top:16px;padding:12px 24px;
                    background:#16302A;color:#fff;text-decoration:none;border-radius:4px;font-weight:600">
            Download Paper
          </a>
          <p style="margin-top:24px;font-size:12px;color:#666">
            This link expires in <strong>24 hours</strong>.
            If you have trouble downloading, reply to this email or contact us on WhatsApp.
          </p>
        </div>
      `,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ─── WhatsApp via Meta Cloud API ─────────────────────────────────
async function sendWhatsAppNotification({ phone, paperTitle, downloadUrl }: WhatsAppParams): Promise<void> {
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
    console.warn('[WhatsApp] Credentials not set — skipping WhatsApp notification');
    return;
  }

  let wa = phone.replace(/\s+/g, '');
  if (wa.startsWith('0')) wa = '254' + wa.slice(1);
  if (wa.startsWith('+')) wa = wa.slice(1);
  if (wa.startsWith('7') || wa.startsWith('1')) wa = '254' + wa;

  await axios.post(
    `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: wa,
      type: 'template',
      template: {
        name: 'download_ready',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: paperTitle },
              { type: 'text', text: downloadUrl },
            ],
          },
        ],
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ─── Main export — call this once after payment confirmed ────────
export async function notifyBuyer({ phone, email, paperTitle, downloadUrl }: NotifyBuyerParams): Promise<void> {
  const results = await Promise.allSettled([
    sendWhatsAppNotification({ phone, paperTitle, downloadUrl }),
    sendEmailNotification({ to: email, paperTitle, downloadUrl }),
  ]);

  results.forEach((r, i) => {
    const channel = i === 0 ? 'WhatsApp' : 'Email';
    if (r.status === 'rejected') {
      const reason = r.reason as { response?: { data: unknown }; message: string };
      console.error(`[Notification] ${channel} delivery failed:`, reason?.response?.data || reason?.message);
    }
  });
}