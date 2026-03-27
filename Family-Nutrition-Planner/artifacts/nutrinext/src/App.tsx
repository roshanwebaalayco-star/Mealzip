import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { LanguageProvider } from "@/contexts/language-context";
import { AppStateProvider } from "@/contexts/app-state-context";

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
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/family-setup" component={FamilySetup} />
        <Route path="/meal-plan" component={MealPlan} />
        <Route path="/recipes" component={RecipeExplorer} />
        <Route path="/chat" component={Chat} />
        <Route path="/scanner" component={Scanner} />
        <Route path="/grocery" component={Grocery} />
        <Route path="/nutrition" component={Nutrition} />
        <Route path="/health" component={HealthLog} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
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
  );
}

export default App;
