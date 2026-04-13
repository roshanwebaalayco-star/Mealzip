export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: SupabaseUser;
}

type AuthChangeListener = (event: "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED", session: SupabaseSession | null) => void;

const STORAGE_KEY = "supabase_session";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for auth");
}

const listeners = new Set<AuthChangeListener>();
let tokenCache: string | null = null;

function readStoredSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as SupabaseSession : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: SupabaseSession | null): void {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function emit(event: "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED", session: SupabaseSession | null): void {
  for (const listener of listeners) {
    listener(event, session);
  }
}

async function authRequest(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  headers.set("apikey", supabaseAnonKey);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function setSessionInternal(session: SupabaseSession | null, event: "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED") {
  tokenCache = session?.access_token ?? null;
  writeStoredSession(session);
  emit(event, session);
}

export const supabase = {
  auth: {
    async getSession() {
      const session = readStoredSession();
      tokenCache = session?.access_token ?? null;
      return { data: { session } };
    },

    async setSession(input: { access_token: string; refresh_token: string }) {
      const { response, data } = await authRequest("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: input.refresh_token }),
      });

      if (!response.ok) {
        return { error: new Error((data as { error_description?: string }).error_description || "Failed to set session") };
      }

      const session = data as SupabaseSession;
      if (!session.access_token) {
        return { error: new Error("Invalid session payload") };
      }

      // Prefer server-issued refreshed tokens, but preserve access token when needed.
      setSessionInternal({ ...session, access_token: session.access_token || input.access_token }, "SIGNED_IN");
      return { error: null };
    },

    async signOut() {
      const session = readStoredSession();
      if (session?.access_token) {
        await authRequest("/auth/v1/logout", { method: "POST" }, session.access_token).catch(() => undefined);
      }
      setSessionInternal(null, "SIGNED_OUT");
    },

    onAuthStateChange(listener: AuthChangeListener) {
      listeners.add(listener);
      return {
        data: {
          subscription: {
            unsubscribe: () => listeners.delete(listener),
          },
        },
      };
    },
  },
};

export function getSupabaseAccessToken(): string | null {
  if (tokenCache) {
    return tokenCache;
  }
  const stored = readStoredSession();
  tokenCache = stored?.access_token ?? null;
  return tokenCache;
}

export function setSupabaseSessionToken(session: SupabaseSession | null): void {
  setSessionInternal(session, session ? "TOKEN_REFRESHED" : "SIGNED_OUT");
}

export async function bootstrapSupabaseSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  setSupabaseSessionToken(data.session);
}

export function setManualAccessToken(token: string | null): void {
  tokenCache = token;
}

export async function signInWithPassword(email: string, password: string): Promise<SupabaseSession> {
  const { response, data } = await authRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error((data as { error_description?: string }).error_description || "Invalid email or password");
  }

  const session = data as SupabaseSession;
  setSessionInternal(session, "SIGNED_IN");
  return session;
}

export async function signUpWithPassword(email: string, password: string, metadata: Record<string, unknown>): Promise<SupabaseSession | null> {
  const { response, data } = await authRequest("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, data: metadata }),
  });

  if (!response.ok) {
    throw new Error((data as { error_description?: string; msg?: string }).error_description || (data as { msg?: string }).msg || "Unable to create account");
  }

  const payload = data as { session?: SupabaseSession | null };
  if (payload.session) {
    setSessionInternal(payload.session, "SIGNED_IN");
  }
  return payload.session ?? null;
}
