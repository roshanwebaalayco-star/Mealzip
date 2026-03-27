import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

setUnauthorizedHandler(() => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = "/login";
});

createRoot(document.getElementById("root")!).render(<App />);
