import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react";
import { setApiFetchTokenGetter } from "@/lib/api-fetch";
import App from "./App";
import "./index.css";

const TOKEN_KEY = "auth_token";
const PUBLIC_PATHS = ["/login", "/register"];

setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
setApiFetchTokenGetter(() => localStorage.getItem(TOKEN_KEY));

setUnauthorizedHandler(() => {
  if (PUBLIC_PATHS.some(p => window.location.pathname.startsWith(p))) {
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("auth_user");
  window.dispatchEvent(new Event("auth:unauthorized"));
});

createRoot(document.getElementById("root")!).render(<App />);
