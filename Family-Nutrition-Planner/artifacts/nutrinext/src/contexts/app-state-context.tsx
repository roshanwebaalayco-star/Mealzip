import { createContext, useState, useEffect, type ReactNode } from "react";
import { useListFamilies, getListFamiliesQueryOptions, type Family } from "@workspace/api-client-react";

const TOKEN_KEY = "auth_token";

function isAuthenticated(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export interface AppStateContextValue {
  activeFamily: Family | undefined;
  setSelectedFamilyId: (id: number | null) => void;
  families: Family[] | undefined;
  isLoading: boolean;
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
  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);

  const activeFamily = families?.find(f => f.id === selectedFamilyId) || families?.[0];

  return (
    <AppStateContext.Provider value={{ activeFamily, setSelectedFamilyId, families, isLoading }}>
      {children}
    </AppStateContext.Provider>
  );
}
