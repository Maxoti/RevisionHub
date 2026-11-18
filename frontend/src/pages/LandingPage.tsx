// frontend/src/pages/LandingPage.tsx
import { useEffect } from "react";

// Branding lives here. No prices are shown on this page: the activation fee
// is shown to the teacher at signup, before they pay anything.
const SITE_NAME = "EdusyncHub";
const ROOT_DOMAIN = "edusynchub.co.ke";

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
    q: "What does it cost to go live?",
    a: "Creating your store and uploading papers is free. When you are ready to take payments, your activation fee depends on your curriculum and is shown to you before you pay. There are no hidden charges and no commission on your sales.",
  },
  {
    q: "What do I need to get started?",
    a: "Just your phone number and a store name. You can create your storefront and upload papers before paying anything. When you are ready to sell, you will need your own M-Pesa Buy Goods Till number.",
  },
  {
    q: "Can I sell more than one curriculum?",
    a: "Yes. One store can hold CBE, 8-4-4 and Cambridge papers. Buyers can filter by curriculum, grade or year, type, term and year of the paper.",
  },
  {
    q: "What happens if I miss a monthly payment?",
    a: "Your store and papers stay saved. Buyers cannot check out and you cannot upload new papers until you renew with a quick STK Push.",
  },
  {
    q: "Which curricula and subjects can I sell?",
    a: "CBE papers from Playgroup to Grade 12, 8-4-4 papers from Form 1 to Form 4, and Cambridge papers from Year 1 to Year 13 including Checkpoint, IGCSE, AS Level and A Level. All subjects, terms and series, with marking schemes and bundles.",
  },
];

export default function LandingPage() {
  useEffect(() => {
    document.title = `${SITE_NAME} | Sell your exam papers online in Kenya`;
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#16233D] font-sans">
      {/* Nav */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 md:px-12 py-4 sm:py-5 w-full max-w-7xl mx-auto">
        <a
          href="/"
          className="font-serif font-bold text-lg sm:text-xl text-[#1A56DB] whitespace-nowrap shrink-0"
        >
          {SITE_NAME}
        </a>
        <nav className="flex items-center gap-3 sm:gap-4 md:gap-6">
          <a
            href="#how-it-works"
            className="hidden md:block text-sm text-[#6B7280] hover:text-[#1A56DB]"
          >
            How it works
          </a>
          <a
            href="#plans"
            className="hidden md:block text-sm text-[#6B7280] hover:text-[#1A56DB]"
          >
            Plans
          </a>
          <a
            href="#faq"
            className="hidden md:block text-sm text-[#6B7280] hover:text-[#1A56DB]"
          >
            FAQ
          </a>
          <a
            href="/signin"
            className="text-sm font-medium text-[#16233D] hover:text-[#1A56DB] whitespace-nowrap"
          >
            <span className="sm:hidden">Log in</span>
            <span className="hidden sm:inline">Seller login</span>
          </a>
          <a
            href="/signup"
            className="text-sm font-medium bg-[#1A56DB] text-white rounded-lg px-3 sm:px-4 py-2 hover:bg-[#1543ad] transition-colors whitespace-nowrap"
          >
            <span className="sm:hidden">Get started</span>
            <span className="hidden sm:inline">Create your store</span>
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-12 py-12 md:py-20 grid md:grid-cols-2 gap-12 items-center w-full max-w-7xl mx-auto">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-[#6B7280] font-medium mb-4">
            For CBE, Cambridge &amp; 8-4-4 teachers
          </p>
          <h1 className="font-serif font-bold text-4xl md:text-5xl leading-tight text-[#16233D]">
            Turn your revision papers into a steady income.
          </h1>
          <p className="text-lg text-[#6B7280] mt-6 leading-relaxed">
            Create your storefront and upload your exam papers free. Parents and
            students pay via M-Pesa STK Push for an instant download, and 100%
            of every sale goes directly into your own M-Pesa Buy Goods Till.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/signup"
              className="bg-[#1A56DB] text-white rounded-xl px-6 py-3.5 font-medium hover:bg-[#1543ad] transition-colors"
            >
              Start free and upload papers
            </a>
            <span className="text-sm text-[#6B7280]">
              Free to start. Pay only when you are ready to sell.
            </span>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg">
            <Stat value="0%" label="Platform commission" />
            <Stat value="100%" label="Direct to your Till" />
            <Stat value="3" label="Curricula supported" />
          </div>
        </div>

        {/* The soft background shows while the photo loads, so the frame
            is never blank. The WebP is the small, fast version; browsers
            that can't use it fall back to the JPG. */}
        <div className="relative aspect-[500/749] max-h-[620px] w-full mx-auto rounded-3xl overflow-hidden shadow-sm bg-[#F7F9FC]">
          <picture>
            <source srcSet="/images/wanjiku.webp" type="image/webp" />
            <img
              src="/images/wanjiku-compressed.jpg"
              alt="A Kenyan teacher"
              width={500}
              height={749}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover object-[50%_35%]"
            />
          </picture>
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
              description="Choose your curriculum (CBE, Cambridge or 8-4-4) and request activation. We set up STK Push on your Till so buyers pay straight to you. You see your activation fee before you pay."
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
            title="Built for CBE, 8-4-4 and Cambridge"
            description="Papers for CBE (Playgroup to Grade 12), 8-4-4 (Form 1 to 4) and Cambridge (Year 1 to 13), with the download link sent to buyers on WhatsApp and email."
          />
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="bg-[#F7F9FC] py-16 w-full scroll-mt-4">
        <div className="px-6 md:px-12 max-w-5xl mx-auto">
          <h2 className="font-serif font-bold text-2xl md:text-3xl text-center text-[#16233D] mb-3">
            Start free. Go live when you are ready.
          </h2>
          <p className="text-center text-sm text-[#6B7280] mb-10">
            Build your store and upload papers at no cost. Pick your curriculum
            when you want to take payments.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <PlanCard
              name="Start"
              title="Starter storefront"
              note="Free to build and upload"
              items={[
                `Claim ${ROOT_DOMAIN}/yourname`,
                "Upload unlimited papers and schemes",
                "Set your own paper prices",
              ]}
              cta={{ label: "Start free", href: "/signup" }}
            />
            <PlanCard
              name="Go live"
              title="CBE & 8-4-4"
              note="For national curriculum teachers"
              highlight
              items={[
                "Direct M-Pesa Till STK Push set up for you",
                "Your store open to buyers",
                "0% commission on all sales",
              ]}
              cta={{ label: "Request activation", href: "/signup?curriculum=national" }}
            />
            <PlanCard
              name="Go live"
              title="Cambridge"
              note="Year 1 to 13, IGCSE and A Level"
              items={[
                "Direct M-Pesa Till STK Push set up for you",
                "Built for Checkpoint, IGCSE, AS and A Level papers and bundles",
                "0% commission on all sales",
              ]}
              cta={{ label: "Request activation", href: "/signup?curriculum=cambridge" }}
            />
          </div>
          <p className="text-center text-xs text-[#6B7280] mt-6">
            Your activation fee is shown before you pay. No hidden charges.
          </p>
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

function PlanCard({
  name,
  title,
  note,
  items,
  cta,
  highlight = false,
}: {
  name: string;
  title: string;
  note: string;
  items: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl p-6 bg-white border ${
        highlight ? "border-[#1A56DB] shadow-md" : "border-black/5"
      }`}
    >
      <p className="text-xs tracking-[0.15em] uppercase text-[#6B7280] font-medium">
        {name}
      </p>
      <p className="font-serif font-bold text-2xl text-[#16233D] mt-2">{title}</p>
      <p className="text-xs text-[#6B7280] mt-1 mb-5">{note}</p>
      <ul className="space-y-2 text-sm text-[#16233D] flex-1">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span className="text-[#1A56DB]">✓</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
      <a
        href={cta.href}
        className={`mt-6 text-center rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
          highlight
            ? "bg-[#1A56DB] text-white hover:bg-[#1543ad]"
            : "border border-[#1A56DB] text-[#1A56DB] hover:bg-[#1A56DB]/5"
        }`}
      >
        {cta.label}
      </a>
    </div>
  );
}