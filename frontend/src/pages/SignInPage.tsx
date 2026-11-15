// frontend/src/pages/SignInPage.tsx
import React, { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "https://edusynchub.co.ke";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/tenants/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid username or password.");
      }

      sessionStorage.setItem("edusync_user", username.trim().toLowerCase());
      if (data.token) {
        sessionStorage.setItem("edusync_token", data.token);
      }
      window.location.href = "/upload.html";
    } catch (err: any) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-12 font-sans">
      <img
        src="/images/Kenyan.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-[50%_35%]"
      />
      <div className="absolute inset-0 bg-[#1A56DB]/80" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.2em] uppercase text-white/80 font-medium mb-2">
            EdusyncHub Seller Portal
          </p>
          <h1 className="font-serif font-bold text-3xl text-white">
            Welcome back
          </h1>
          <p className="text-sm text-white/85 mt-2">
            Sign in to upload exam papers, manage your store, or renew your subscription.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-md border border-black/5 p-6 space-y-4"
        >
          <label className="block">
            <span className="text-xs font-medium text-[#16233D] mb-1 block">
              Admin Username
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. jane_exams"
              required
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/30 focus:border-[#1A56DB]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-[#16233D] mb-1 block">
              Password
            </span>
            <div className="relative">
              <input
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-black/10 bg-white pl-3 pr-9 py-2.5 text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/30 focus:border-[#1A56DB]"
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
            {submitting ? "Signing in…" : "Sign in to Dashboard"}
          </button>

          <p className="text-center text-sm text-[#6B7280]">
            Don’t have a storefront yet?{" "}
            <a
              href="/signup"
              className="text-[#1A56DB] font-medium underline underline-offset-2"
            >
              Create free account
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
