import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { LanguageProvider } from "@/contexts/language-context";
import { AppStateProvider } from "@/contexts/app-state-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect } from "react";

// Pages
import Dashboard from "@/pages/Dashboard";
import FamilySetup from "@/pages/FamilySetup";
import MealPlan from "@/pages/MealPlan";
import RecipeExplorer from "@/pages/RecipeExplorer";
import Chat from "@/pages/Chat";
import Scanner from "@/pages/Scanner";
import Grocery from "@/pages/Grocery";
import Nutrition from "@/pages/Nutrition";
import HealthLog from "@/pages/HealthLog";
import Pantry from "@/pages/Pantry";
import PantryScan from "@/pages/PantryScan";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/not-found";

const TOKEN_KEY = "auth_token";

function isAuthenticated(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (!isAuthenticated()) {
    return <Redirect to="/login" />;
  }
  return <Component />;
}

const queryClient = new QueryClient();

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

function Router() {
  return (
    <Layout>
      <AuthGuard />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/family-setup" component={() => <ProtectedRoute component={FamilySetup} />} />
        <Route path="/meal-plan" component={() => <ProtectedRoute component={MealPlan} />} />
        <Route path="/recipes" component={() => <ProtectedRoute component={RecipeExplorer} />} />
        <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
        <Route path="/scanner" component={() => <ProtectedRoute component={Scanner} />} />
        <Route path="/grocery" component={() => <ProtectedRoute component={Grocery} />} />
        <Route path="/pantry" component={() => <ProtectedRoute component={Pantry} />} />
        <Route path="/pantry-scan" component={() => <ProtectedRoute component={PantryScan} />} />
        <Route path="/nutrition" component={() => <ProtectedRoute component={Nutrition} />} />
        <Route path="/health" component={() => <ProtectedRoute component={HealthLog} />} />
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
