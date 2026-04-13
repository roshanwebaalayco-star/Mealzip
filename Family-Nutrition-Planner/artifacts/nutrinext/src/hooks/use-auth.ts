import { useState, useEffect, useCallback } from "react";
import { supabase, setSupabaseSessionToken, setManualAccessToken } from "@/lib/supabase-auth";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  primaryLanguage: string;
  createdAt: string;
}

export interface AuthSessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  tokenType?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

async function apiRequest(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clearAuth = useCallback(async () => {
    localStorage.removeItem("demo_family_cache");
    localStorage.removeItem("demo_meal_plan_cache");
    localStorage.removeItem("active_family");
    sessionStorage.clear();
    setUser(null);
    setManualAccessToken(null);
    window.dispatchEvent(new Event("auth:unauthorized"));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }) as { session: AuthSessionPayload; user: AuthUser };

      const { error } = await supabase.auth.setSession({
        access_token: data.session.accessToken,
        refresh_token: data.session.refreshToken,
      });
      if (error) {
        throw error;
      }
      setUser(data.user);
      window.dispatchEvent(new Event("auth:login"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const demoLogin = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetch("/api/demo/quick-login", { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error || `Request failed: ${res.status}`);
        }
        return res.json() as Promise<{ token: string; user: AuthUser; family: unknown; mealPlan: unknown }>;
      });

      setManualAccessToken(data.token);
      setUser(data.user);
      if (data.family) {
        try { localStorage.setItem("demo_family_cache", JSON.stringify(data.family)); } catch { /* ignore */ }
      }
      if (data.mealPlan) {
        try { localStorage.setItem("demo_meal_plan_cache", JSON.stringify(data.mealPlan)); } catch { /* ignore */ }
      }
      window.dispatchEvent(new Event("auth:login"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, primaryLanguage: string) => {
    setIsLoading(true);
    try {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name, primaryLanguage }),
      }) as { session: AuthSessionPayload; user: AuthUser };

      const { error } = await supabase.auth.setSession({
        access_token: data.session.accessToken,
        refresh_token: data.session.refreshToken,
      });
      if (error) {
        throw error;
      }
      setUser(data.user);
      window.dispatchEvent(new Event("auth:login"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    await supabase.auth.signOut();
    await clearAuth();
  }, [clearAuth]);

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setUser(null);
      return;
    }
    try {
      const userData = await apiRequest("/api/auth/me") as AuthUser;
      setUser(userData);
    } catch {
      await clearAuth();
    }
  }, [clearAuth]);

  useEffect(() => {
    refreshUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseSessionToken(session);
      if (!session) {
        setUser(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [refreshUser]);

  return { user, isLoading, login, demoLogin, register, logout, isAuthenticated: !!user };
}
