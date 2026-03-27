import { createContext, useState, type ReactNode } from "react";
import { useListFamilies, type Family } from "@workspace/api-client-react";

export interface AppStateContextValue {
  activeFamily: Family | undefined;
  setSelectedFamilyId: (id: number | null) => void;
  families: Family[] | undefined;
  isLoading: boolean;
}

export const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { data: families, isLoading } = useListFamilies();
  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);

  const activeFamily = families?.find(f => f.id === selectedFamilyId) || families?.[0];

  return (
    <AppStateContext.Provider value={{ activeFamily, setSelectedFamilyId, families, isLoading }}>
      {children}
    </AppStateContext.Provider>
  );
}
