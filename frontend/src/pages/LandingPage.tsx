// frontend/src/pages/LandingPage.tsx
import { useEffect } from "react";

// Change prices and branding here only. Keep them in step with the backend
// (the billing messages in saasRoutes.ts).
const SITE_NAME = "EdusyncHub";
const ROOT_DOMAIN = "edusynchub.co.ke";
const SETUP_FEE = "KES 4000";
const MONTHLY_FEE = "KES 300";

const FAQS = [
  {
    q: "Do parents and students need an account to buy?",
    a: "No. They open your store link, pay with M-Pesa STK Push, and the download unlocks straight away. The link is also sent to them on WhatsApp and email.",
  },
  {
    q: "Where does the money go?",
    a: "Straight into your own M-Pesa Buy Goods Till. We never hold your sales money and we take no commission or percentage.",
  },
  {
    q: "What do I need to get started?",
    a: "Just your phone number and a store name. You can create your storefront and upload papers before paying anything. When you are ready to sell, you will need your own M-Pesa Buy Goods Till number.",
  },
  {
    q: "What happens if I miss a monthly payment?",
    a: "Your store and papers stay saved. Buyers cannot check out and you cannot upload new papers until you renew with a quick STK Push.",
  },
  {
    q: "Which curricula and subjects can I sell?",
    a: "CBE, 8-4-4 and IGCSE papers across all grades, terms and subjects, including marking schemes and bundles.",
  },
];

export default function LandingPage() {
  useEffect(() => {
    document.title = `${SITE_NAME} | Sell your exam papers online in Kenya`;
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#16233D] font-sans">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 md:px-12 py-5 w-full max-w-7xl mx-auto">
        <a href="/" className="font-serif font-bold text-xl text-[#1A56DB]">
          {SITE_NAME}
        </a>
        <nav className="flex items-center gap-4 md:gap-6">
          <a
            href="#how-it-works"
            className="hidden md:block text-sm text-[#6B7280] hover:text-[#1A56DB]"
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="hidden md:block text-sm text-[#6B7280] hover:text-[#1A56DB]"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="hidden md:block text-sm text-[#6B7280] hover:text-[#1A56DB]"
          >
            FAQ
          </a>
          <a
            href="/signin"
            className="text-sm font-medium text-[#16233D] hover:text-[#1A56DB]"
          >
            Seller login
          </a>
          <a
            href="/signup"
            className="text-sm font-medium bg-[#1A56DB] text-white rounded-lg px-4 py-2 hover:bg-[#1543ad] transition-colors"
          >
            Create your store
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-12 py-12 md:py-20 grid md:grid-cols-2 gap-12 items-center w-full max-w-7xl mx-auto">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-[#6B7280] font-medium mb-4">
            For Kenyan teachers
          </p>
          <h1 className="font-serif font-bold text-4xl md:text-5xl leading-tight text-[#16233D]">
            Turn your revision papers into a steady income.
          </h1>
          <p className="text-lg text-[#6B7280] mt-6 leading-relaxed">
            Create your storefront and upload your exam papers free. Parents and
            students across Kenya pay KES 50 to 100 via M-Pesa STK Push for an
            instant download, and 100% of every sale goes directly into your
            own M-Pesa Buy Goods Till.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/signup"
              className="bg-[#1A56DB] text-white rounded-xl px-6 py-3.5 font-medium hover:bg-[#1543ad] transition-colors"
            >
              Start free and upload papers
            </a>
            <span className="text-sm text-[#6B7280]">
              {SETUP_FEE} one-time setup · {MONTHLY_FEE}/month
            </span>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg">
            <Stat value="100%" label="Direct to your Till" />
            <Stat value={SETUP_FEE} label="One-time onboarding" />
            <Stat value={MONTHLY_FEE} label="Monthly platform fee" />
          </div>
        </div>

        <div className="relative aspect-[500/749] max-h-[620px] w-full mx-auto rounded-3xl overflow-hidden shadow-sm">
          <img
            src="/images/wanjiku.jpg"
            alt="A Kenyan teacher"
            className="w-full h-full object-cover object-[50%_35%]"
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[#F7F9FC] py-16 w-full scroll-mt-4">
        <div className="px-6 md:px-12 max-w-7xl mx-auto">
          <h2 className="font-serif font-bold text-2xl md:text-3xl text-center text-[#16233D] mb-12">
            Three steps to your first sale
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Step
              number="1"
              title="Create your store and upload free"
              description={`Claim your own link (${ROOT_DOMAIN}/yourname) and upload your revision papers and marking schemes first.`}
            />
            <Step
              number="2"
              title="Connect your M-Pesa Till"
              description={`When you are ready to sell, pay ${SETUP_FEE} one-time onboarding. It covers your M-Pesa Till STK Push integration and your first month.`}
            />
            <Step
              number="3"
              title="Get paid directly on M-Pesa"
              description="Share your link on WhatsApp and Facebook. When a buyer pays, the money lands straight in your Till and their download unlocks instantly."
            />
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="px-6 md:px-12 py-16 w-full max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          <ValueProp
            title="No account needed for parents"
            description="Parents pay via M-Pesa STK Push and download immediately. There is no sign-up step to cost you a sale."
          />
          <ValueProp
            title="Zero commission on your sales"
            description="We never hold your money or deduct a percentage. Every shilling paid by buyers goes straight to your M-Pesa Till."
          />
          <ValueProp
            title="Built for Kenyan classrooms"
            description="CBE, 8-4-4 and IGCSE papers across all grades and terms, with the download link sent to buyers on WhatsApp and email."
          />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-[#F7F9FC] py-16 w-full scroll-mt-4">
        <div className="px-6 md:px-12 max-w-4xl mx-auto">
          <h2 className="font-serif font-bold text-2xl md:text-3xl text-center text-[#16233D] mb-3">
            Simple, honest pricing
          </h2>
          <p className="text-center text-sm text-[#6B7280] mb-10">
            Start free. Pay only when you are ready to take payments.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <PriceCard
              name="Start"
              price="Free"
              note="No card, no commitment"
              items={[
                "Your own store link",
                "Upload papers and marking schemes",
                "Set your own prices",
              ]}
            />
            <PriceCard
              name="Go live"
              price={SETUP_FEE}
              note="One-time"
              highlight
              items={[
                "M-Pesa Till STK Push set up for you",
                "First month included",
                "100% of sales to your Till",
              ]}
            />
            <PriceCard
              name="Stay live"
              price={`${MONTHLY_FEE}/month`}
              note="After your first month"
              items={[
                "Keep your store open to buyers",
                "Renew with a quick STK Push",
                "No commission, ever",
              ]}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 md:px-12 py-16 w-full max-w-3xl mx-auto scroll-mt-4">
        <h2 className="font-serif font-bold text-2xl md:text-3xl text-center text-[#16233D] mb-8">
          Questions teachers ask
        </h2>
        <div className="divide-y divide-black/10 border-y border-black/10">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium text-[#16233D]">
                {f.q}
                <span className="text-[#1A56DB] transition-transform group-open:rotate-45 text-xl leading-none">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-[#6B7280] leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#1A56DB] py-16 text-center px-6 w-full">
        <h2 className="font-serif font-bold text-2xl md:text-3xl text-white mb-4">
          Your papers are already written. Start earning from them today.
        </h2>
        <p className="text-white/85 text-sm mb-2">
          Create your storefront and upload your papers before paying a shilling.
        </p>
        <a
          href="/signup"
          className="inline-block mt-4 bg-white text-[#1A56DB] rounded-xl px-6 py-3.5 font-medium hover:bg-white/90 transition-colors"
        >
          Create your free store
        </a>
      </section>

      <footer className="text-center text-sm text-[#6B7280] py-8">
        {SITE_NAME} · Nairobi, Kenya · © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-serif font-bold text-2xl text-[#1A56DB]">{value}</p>
      <p className="text-xs text-[#6B7280] mt-1">{label}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-6">
      <div className="w-8 h-8 rounded-full bg-[#1A56DB] text-white flex items-center justify-center font-medium text-sm mb-4">
        {number}
      </div>
      <h3 className="font-medium text-[#16233D] mb-2">{title}</h3>
      <p className="text-sm text-[#6B7280] leading-relaxed">{description}</p>
    </div>
  );
}

function ValueProp({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="font-medium text-[#16233D] mb-2">{title}</h3>
      <p className="text-sm text-[#6B7280] leading-relaxed">{description}</p>
    </div>
  );
}

function PriceCard({
  name,
  price,
  note,
  items,
  highlight = false,
}: {
  name: string;
  price: string;
  note: string;
  items: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-6 bg-white border ${
        highlight ? "border-[#1A56DB] shadow-md" : "border-black/5"
      }`}
    >
      <p className="text-xs tracking-[0.15em] uppercase text-[#6B7280] font-medium">
        {name}
      </p>
      <p className="font-serif font-bold text-3xl text-[#16233D] mt-2">{price}</p>
      <p className="text-xs text-[#6B7280] mt-1 mb-5">{note}</p>
      <ul className="space-y-2 text-sm text-[#16233D]">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span className="text-[#1A56DB]">✓</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}