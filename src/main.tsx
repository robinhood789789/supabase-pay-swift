import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { I18nProvider } from "@/lib/i18n";
import { setupSecurityHeaders } from "@/lib/security/headers";

// Set up security headers
setupSecurityHeaders();

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
