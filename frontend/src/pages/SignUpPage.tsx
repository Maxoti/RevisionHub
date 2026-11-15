import React, { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://edusynchub.co.ke";

export default function SignUpPage() {
  const [form, setForm] = useState({
    storeName: "",
    storeSlug: "",
    username: "",
    phone: "",
    password: "",
  });
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setForm((f) => ({ ...f, storeName: val, storeSlug: autoSlug }));
  };

  const update =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password needs at least 6 characters.");
      return;
    }
    if (!form.storeSlug || form.storeSlug.length < 3) {
      setError("Store URL link must be at least 3 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/tenants/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Could not create account. Try another username or store link."
        );
      }

      sessionStorage.setItem("edusync_user", form.username.trim().toLowerCase());
      window.location.href = "/saas-upload.html?welcome=1";
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-12 font-body">
      <img
        src="/images/Kenyan.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-[50%_35%]"
      />
      <div className="absolute inset-0 bg-[#1A56DB]/80" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.2em] uppercase text-white/80 font-medium mb-2">
            EdusyncHub for Educators
          </p>
          <h1 className="font-display font-bold text-3xl text-white">
            Create your storefront
          </h1>
          <p className="text-sm text-white/85 mt-2">
            Start free and upload your papers first. Activate M-Pesa Till
            checkout whenever you are ready.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-md border border-black/5 p-6 space-y-4"
        >
          <Field
            label="Store Display Name"
            type="text"
            value={form.storeName}
            onChange={handleStoreNameChange}
            placeholder="e.g. Mwalimu Jane Revision Hub"
            required
          />

          <div>
            <span className="text-xs font-medium text-[#16233D] mb-1 block">
              Your Storefront Link
            </span>
            <div className="flex items-center rounded-lg border border-black/10 overflow-hidden focus-within:ring-2 focus-within:ring-[#1A56DB]/40">
              <span className="bg-[#F7F9FC] text-[#6B7280] text-xs px-3 py-2.5 border-r border-black/10 select-none">
                edusynchub.co.ke/
              </span>
              <input
                type="text"
                value={form.storeSlug}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    storeSlug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, ""),
                  }))
                }
                placeholder="jane"
                required
                className="w-full px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Admin Username"
              type="text"
              value={form.username}
              onChange={update("username")}
              placeholder="e.g. jane_exams"
              required
            />
            <Field
              label="WhatsApp / M-Pesa Phone"
              type="tel"
              value={form.phone}
              onChange={update("phone")}
              placeholder="07XXXXXXXX"
              required
            />
          </div>

          <PasswordField
            label="Password"
            value={form.password}
            onChange={update("password")}
            required
          />
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-medium hover:bg-[#1543ad] transition-colors disabled:opacity-60"
          >
            {submitting
              ? "Creating storefront…"
              : "Create Free Store & Upload Papers"}
          </button>

          <p className="text-center text-sm text-[#6B7280]">
            Already have an account?{" "}
            <a
              href="/signin"
              className="text-[#1A56DB] font-medium underline underline-offset-2"
            >
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#16233D] mb-1 block">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/30 focus:border-[#1A56DB]"
      />
    </label>
  );
}

function PasswordField({
  label,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="text-xs font-medium text-[#16233D] mb-1 block">
        {label}
      </span>
      <div className="relative">
        <input
          {...props}
          type={visible ? "text" : "password"}
          className="w-full rounded-lg border border-black/10 bg-white pl-3 pr-9 py-2 text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/30 focus:border-[#1A56DB]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-[#6B7280] hover:text-[#16233D]"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}
