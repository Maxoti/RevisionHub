// frontend/src/main.tsx
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import LandingPage from "./pages/LandingPage";
import SignUpPage from "./pages/SignUpPage";
import SignInPage from "./pages/SignInPage";
import "./index.css";

// Lazy so a premium build never loads the SaaS storefront code, and a SaaS
// build never loads the single-tenant app.
const App = lazy(() => import("./App"));
const SaasApp = lazy(() => import("./App.saas"));

const isSaasMode = import.meta.env.VITE_APP_MODE === "saas";
const cleanPath = window.location.pathname.replace(/\/+$/, "") || "/";

function RootRouter() {
  if (isSaasMode) {
    if (cleanPath === "/") return <LandingPage />;
    if (cleanPath === "/signup") return <SignUpPage />;
    if (cleanPath === "/signin") return <SignInPage />;

    // SaaS storefront slugs (e.g. /jane)
    return (
      <Suspense fallback={null}>
        <SaasApp />
      </Suspense>
    );
  }

  // Premium single-tenant sites
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootRouter />
  </React.StrictMode>
);