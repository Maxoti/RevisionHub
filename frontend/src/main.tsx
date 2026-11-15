// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import LandingPage from "./pages/LandingPage";
import SignUpPage from "./pages/SignUpPage";
import SignInPage from "./pages/SignInPage";
import "./index.css";

const isSaasMode = import.meta.env.VITE_APP_MODE === "saas";
const cleanPath = window.location.pathname.replace(/\/+$/, "") || "/";

function RootRouter() {
  if (isSaasMode) {
    if (cleanPath === "/") return <LandingPage />;
    if (cleanPath === "/signup") return <SignUpPage />;
    if (cleanPath === "/signin") return <SignInPage />;
  }

  // Premium single-tenant sites AND SaaS storefront slugs (e.g. /jane)
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootRouter />
  </React.StrictMode>
);
