import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const TOKEN_KEY = "auth_token";

setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

setUnauthorizedHandler(() => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("auth_user");
  window.location.href = "/login";
});

createRoot(document.getElementById("root")!).render(<App />);
