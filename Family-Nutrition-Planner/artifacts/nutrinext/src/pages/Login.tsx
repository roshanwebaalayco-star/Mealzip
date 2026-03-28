import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const handleInstantDemo = async () => {
    setIsDemoLoading(true);
    try {
      const res = await fetch("/api/demo/instant");
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Demo failed (${res.status})`);
      }
      const data = await res.json() as {
        token: string;
        user: { id: number; email: string; name: string; primaryLanguage: string; createdAt: string };
        family: unknown;
        mealPlan: unknown;
        message?: string;
      };
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      if (data.family) {
        try { localStorage.setItem("demo_family_cache", JSON.stringify(data.family)); } catch { /* ignore */ }
      }
      if (data.mealPlan && data.family && typeof data.family === "object" && data.family !== null) {
        const fam = data.family as { id?: number };
        if (fam.id) {
          try { localStorage.setItem(`meal_plan_cache_${fam.id}`, JSON.stringify(data.mealPlan)); } catch { /* ignore */ }
        }
      }
      window.dispatchEvent(new Event("auth:login"));
      navigate("/meal-plan");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Demo login failed.";
      toast({ variant: "destructive", title: "Demo Login Failed", description: msg });
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all fields." });
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed. Please check your credentials.";
      toast({ variant: "destructive", title: "Login Failed", description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center p-6 min-h-[82vh]"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl glass-panel flex items-center justify-center mx-auto mb-4">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="ParivarSehat"
              className="w-10 h-10 object-contain"
            />
          </div>
          <h1 className="font-display font-bold text-2xl text-foreground">Welcome Back</h1>
          <p className="text-sm text-muted-foreground mt-1">Log in to your ParivarSehat account</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl h-11 font-semibold"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Log In
          </Button>
        </form>

        {/* Judge Demo — instant one-tap access */}
        <div className="mt-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground font-medium">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <button
            type="button"
            onClick={handleInstantDemo}
            disabled={isDemoLoading}
            className="w-full h-12 rounded-xl border-2 border-dashed border-primary/50 bg-gradient-to-r from-primary/8 to-orange-500/8 hover:from-primary/14 hover:to-orange-500/14 text-primary font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-sm"
          >
            {isDemoLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4 text-orange-500" />
            }
            🎯 Try with Demo Family (60 seconds)
          </button>
          <p className="text-center text-[10px] text-muted-foreground mt-1.5">
            Loads Sharma family demo with a full 7-day AI meal plan — no signup needed
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Don't have an account?{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
