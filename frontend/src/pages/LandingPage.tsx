// frontend/src/pages/LandingPage.tsx
import React from "react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#16233D] font-sans">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 md:px-12 py-5 w-full max-w-7xl mx-auto">
        <span className="font-serif font-bold text-xl text-[#1A56DB]">
          EdusyncHub
        </span>
        <div className="flex items-center gap-6">
          <a
            href="/signin"
            className="text-sm font-medium text-[#16233D] hover:text-[#1A56DB]"
          >
            Seller Login
          </a>
          <a
            href="/signup"
            className="text-sm font-medium bg-[#1A56DB] text-white rounded-lg px-4 py-2 hover:bg-[#1543ad] transition-colors"
          >
            Create your storefront
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-12 py-12 md:py-20 grid md:grid-cols-2 gap-12 items-center w-full max-w-7xl mx-auto">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-[#6B7280] font-medium mb-4">
            For Kenyan teachers.
          </p>
          <h1 className="font-serif font-bold text-4xl md:text-5xl leading-tight text-[#16233D]">
            Turn your revision papers into a steady income.
          </h1>
          <p className="text-lg text-[#6B7280] mt-6 leading-relaxed">
            Create your storefront and upload your exam papers free. Parents and
            students across Kenya pay KES 50–100 via M-Pesa STK Push for instant
            download — and 100% of every sale goes directly into your own
            M-Pesa Buy Goods Till.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/signup"
              className="bg-[#1A56DB] text-white rounded-xl px-6 py-3.5 font-medium hover:bg-[#1543ad] transition-colors"
            >
              Start free & upload papers
            </a>
            <span className="text-sm text-[#6B7280]">
              KES 2,000 one-time M-Pesa setup · KES 300/month
            </span>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg">
            <Stat value="100%" label="Direct to your Till" />
            <Stat value="KES 2,000" label="One-time onboarding" />
            <Stat value="KES 300" label="Monthly platform fee" />
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
      <section className="bg-[#F7F9FC] py-16 w-full">
        <div className="px-6 md:px-12 max-w-7xl mx-auto">
          <h2 className="font-serif font-bold text-2xl md:text-3xl text-center text-[#16233D] mb-12">
            Three steps to your first sale
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Step
              number="1"
              title="Create your store & upload free"
              description="Claim your custom link (edusynchub.co.ke/yourname) and upload your revision papers and marking schemes first."
            />
            <Step
              number="2"
              title="Connect your M-Pesa Till"
              description="When ready to sell, pay KES 2,000 one-time onboarding (includes M-Pesa Till STK Push integration + Month 1)."
            />
            <Step
              number="3"
              title="Get paid directly on M-Pesa"
              description="Share your link on WhatsApp and Facebook. When a buyer pays, 100% lands straight in your Till and their PDF unlocks instantly."
            />
          </div>
        </div>
      </section>

      {/* Trust / value props */}
      <section className="px-6 md:px-12 py-16 w-full max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          <ValueProp
            title="No account needed for parents"
            description="Parents pay via M-Pesa STK Push and download immediately — zero sign-up friction that costs you sales."
          />
          <ValueProp
            title="Zero commission on your sales"
            description="We never hold your money or deduct percentages. Every shilling paid by buyers goes straight to your M-Pesa Till."
          />
          <ValueProp
            title="Built for Kenyan classrooms"
            description="CBE, 8-4-4, and IGCSE curricula across all grades and terms — plus direct WhatsApp order backup."
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#1A56DB] py-16 text-center px-6 w-full">
        <h2 className="font-serif font-bold text-2xl md:text-3xl text-white mb-4">
          Your papers are already written. Start earning from them today.
        </h2>
        <p className="text-white/85 text-sm mb-2">
          Create your storefront free and upload your papers before paying a shilling.
        </p>
        <a
          href="/signup"
          className="inline-block mt-4 bg-white text-[#1A56DB] rounded-xl px-6 py-3.5 font-medium hover:bg-white/90 transition-colors"
        >
          Create your free storefront
        </a>
      </section>

      <footer className="text-center text-sm text-[#6B7280] py-8">
        EdusyncHub · Nairobi, Kenya
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
