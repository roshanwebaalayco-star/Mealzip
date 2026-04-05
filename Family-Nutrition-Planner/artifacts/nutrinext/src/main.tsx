import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react";
import { setApiFetchTokenGetter } from "@/lib/api-fetch";
import { bootstrapSupabaseSession, getSupabaseAccessToken, setSupabaseSessionToken, supabase } from "@/lib/supabase-auth";
import App from "./App";
import "./index.css";

const PUBLIC_PATHS = ["/login", "/register"];

setAuthTokenGetter(() => getSupabaseAccessToken());
setApiFetchTokenGetter(() => getSupabaseAccessToken());

setUnauthorizedHandler(() => {
  if (PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p))) {
    return;
  }
  setSupabaseSessionToken(null);
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  window.dispatchEvent(new Event("auth:unauthorized"));
});

void bootstrapSupabaseSession();

supabase.auth.onAuthStateChange((_event, session) => {
  setSupabaseSessionToken(session);

  // Temporary compatibility mode for modules still reading localStorage directly.
  if (session?.access_token) {
    localStorage.setItem("auth_token", session.access_token);
  } else {
    localStorage.removeItem("auth_token");
  }
});

createRoot(document.getElementById("root")!).render(<App />);
