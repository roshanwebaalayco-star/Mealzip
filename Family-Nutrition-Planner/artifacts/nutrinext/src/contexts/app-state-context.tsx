import { createContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListFamilies, getListFamiliesQueryOptions, type Family } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api-fetch";

const TOKEN_KEY = "auth_token";

function isAuthenticated(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export interface ProfileBootstrapState {
  profileComplete: boolean;
  hasFamilyProfile: boolean;
  hasBudget: boolean;
  hasWeeklyContext: boolean;
  lastActiveContext: string;
  familyId: number | null;
}

export interface AppStateContextValue {
  activeFamily: Family | undefined;
  setSelectedFamilyId: (id: number | null) => void;
  families: Family[] | undefined;
  isLoading: boolean;
  profileBootstrap: ProfileBootstrapState | undefined;
  isProfileBootstrapLoading: boolean;
}

export const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(isAuthenticated);

  useEffect(() => {
    const onUnauthorized = () => setAuthenticated(false);
    const onLogin = () => setAuthenticated(isAuthenticated());

    window.addEventListener("auth:unauthorized", onUnauthorized);
    window.addEventListener("auth:login", onLogin);
    return () => {
      window.removeEventListener("auth:unauthorized", onUnauthorized);
      window.removeEventListener("auth:login", onLogin);
    };
  }, []);

  const { data: families, isLoading } = useListFamilies({ query: { ...getListFamiliesQueryOptions(), enabled: authenticated } });
  const { data: profileBootstrap, isLoading: isProfileBootstrapLoading } = useQuery<ProfileBootstrapState>({
    queryKey: ["profile-bootstrap"],
    enabled: authenticated,
    queryFn: async () => {
      const response = await apiFetch("/api/families/bootstrap");
      if (!response.ok) {
        throw new Error(`Failed to load profile bootstrap (${response.status})`);
      }
      return response.json() as Promise<ProfileBootstrapState>;
    },
  });

  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);

  const activeFamily = families?.find(f => f.id === selectedFamilyId) || families?.[0];

  return (
    <AppStateContext.Provider value={{
      activeFamily,
      setSelectedFamilyId,
      families,
      isLoading,
      profileBootstrap,
      isProfileBootstrapLoading,
    }}>
      {children}
    </AppStateContext.Provider>
  );
}
