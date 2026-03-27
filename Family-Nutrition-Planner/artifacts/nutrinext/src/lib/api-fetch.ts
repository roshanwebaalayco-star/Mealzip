const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

const PUBLIC_PATHS = ["/login", "/register"];

function handleUnauthorized(): void {
  if (PUBLIC_PATHS.some(p => window.location.pathname.startsWith(p))) {
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("auth:unauthorized"));
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    handleUnauthorized();
  }

  return res;
}
