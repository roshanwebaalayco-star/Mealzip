import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { LanguageProvider } from "@/contexts/language-context";
import { AppStateProvider } from "@/contexts/app-state-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect } from "react";
import { useAppState } from "@/hooks/use-app-state";

import Dashboard from "@/pages/Dashboard";
import FamilySetup from "@/pages/FamilySetup";
import MealPlan from "@/pages/MealPlan";
import RecipeExplorer from "@/pages/RecipeExplorer";
import Chat from "@/pages/Chat";
import Grocery from "@/pages/Grocery";
import HealthLog from "@/pages/HealthLog";
import Pantry from "@/pages/Pantry";
import PantryScan from "@/pages/PantryScan";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Profile from "@/pages/Profile";
import WeeklyContext from "@/pages/WeeklyContext";
import RecipeDetail from "@/pages/RecipeDetail";
import Scanner from "@/pages/Scanner";
import MealGenPage from "@/pages/MealGenPage";
import NotFound from "@/pages/not-found";

const TOKEN_KEY = "auth_token";
const LAST_ACTIVE_SECTION_KEY = "nutrinext_last_active_section";

function isAuthenticated(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (!isAuthenticated()) {
    return <Redirect to="/login" />;
  }
  return <ProfileGuard component={Component} />;
}

function ProfileGuard({ component: Component }: { component: React.ComponentType }) {
  const { isLoading, isProfileBootstrapLoading, profileBootstrap } = useAppState();

  if (isLoading || isProfileBootstrapLoading) {
    return <LoadingSpinner />;
  }

  if (!profileBootstrap?.hasFamilyProfile) {
    return <Redirect to="/family-setup" />;
  }

  return <Component />;
}

function MealGenerationGuard({ component: Component }: { component: React.ComponentType }) {
  const { isLoading, isProfileBootstrapLoading, profileBootstrap } = useAppState();

  if (isLoading || isProfileBootstrapLoading) {
    return <LoadingSpinner />;
  }

  if (!profileBootstrap?.hasFamilyProfile) {
    return <Redirect to="/family-setup" />;
  }
  if (!profileBootstrap.hasBudget) {
    return <Redirect to="/profile" />;
  }
  if (!profileBootstrap.hasWeeklyContext) {
    return <Redirect to="/meal-plan/context" />;
  }

  return <Component />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
  },
});

function AuthGuard() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const handler = () => {
      queryClient.clear();
      setLocation("/login");
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [setLocation]);
  return null;
}

function LastActiveTracker() {
  const [location] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) return;
    if (["/login", "/register"].includes(location)) return;
    localStorage.setItem(LAST_ACTIVE_SECTION_KEY, location);
  }, [location]);

  return null;
}

function Router() {
  return (
    <Layout>
      <AuthGuard />
      <LastActiveTracker />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/family-setup" component={() => (isAuthenticated() ? <FamilySetup /> : <Redirect to="/login" />)} />
        <Route path="/meal-plan" component={() => <ProtectedRoute component={MealPlan} />} />
        <Route path="/meal-plan/generate" component={() => <MealGenerationGuard component={MealGenPage} />} />
        <Route path="/meal-plan/context" component={() => <ProtectedRoute component={WeeklyContext} />} />
        <Route path="/recipes/:id" component={() => <ProtectedRoute component={RecipeDetail} />} />
        <Route path="/recipes" component={() => <ProtectedRoute component={RecipeExplorer} />} />
        <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
        <Route path="/grocery" component={() => <ProtectedRoute component={Grocery} />} />
        <Route path="/pantry" component={() => <ProtectedRoute component={Pantry} />} />
        <Route path="/pantry-scan" component={() => <ProtectedRoute component={PantryScan} />} />
        <Route path="/scanner" component={() => <MealGenerationGuard component={Scanner} />} />
        <Route path="/nutrition">{() => <Redirect to="/insights" />}</Route>
        <Route path="/health">{() => <Redirect to="/insights" />}</Route>
        <Route path="/insights" component={() => <ProtectedRoute component={HealthLog} />} />
        <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppStateProvider>
          <LanguageProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </LanguageProvider>
        </AppStateProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
