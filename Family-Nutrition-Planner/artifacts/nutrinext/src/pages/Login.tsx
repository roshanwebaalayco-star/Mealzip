import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const { toast } = useToast();
  const { login, register } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) navigate("/profile");
  }, [navigate]);

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

  const handleSignIn = async (e: React.FormEvent) => {
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all fields." });
      return;
    }
    if (password.length < 8) {
      toast({ variant: "destructive", title: "Error", description: "Password must be at least 8 characters." });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Error", description: "Passwords do not match." });
      return;
    }
    setIsLoading(true);
    try {
      await register(email.trim(), password, name || email.split("@")[0], "english");
      navigate("/family-setup");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      toast({ variant: "destructive", title: "Registration Failed", description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setShowPassword(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center p-6 min-h-[82vh] animate-fade-up"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl glass-elevated flex items-center justify-center mx-auto mb-4">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="ParivarSehat"
              className="w-10 h-10 object-contain"
            />
          </div>
          <h1 className="font-semibold text-2xl" style={{ letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            {activeTab === "signin" ? "Welcome Back" : "Create Account"}<span style={{ color: 'var(--brand-400)' }}> ·</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
            {activeTab === "signin" ? "Log in to your ParivarSehat account" : "Start your family nutrition journey"}
          </p>
        </div>

        <div className="flex rounded-xl overflow-hidden mb-5 glass-elevated p-1">
          <button
            type="button"
            onClick={() => { setActiveTab("signin"); resetForm(); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "signin"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("signup"); resetForm(); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "signup"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        {activeTab === "signin" ? (
          <form onSubmit={handleSignIn} className="glass-elevated rounded-2xl p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="input-glass rounded-xl"
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
                  className="input-glass rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="btn-primary w-full h-12"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="glass-elevated rounded-2xl p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="input-glass rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="input-glass rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-red-500">Password must be at least 8 characters</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="input-glass rounded-xl"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="btn-primary w-full h-12"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Account
            </Button>
          </form>
        )}

        <div className="mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="divider flex-1" />
            <span className="label-caps px-3">or</span>
            <div className="divider flex-1" />
          </div>
          <button
            type="button"
            onClick={handleInstantDemo}
            disabled={isDemoLoading}
            className="btn-brand w-full h-12 rounded-2xl border-2 border-dashed border-[var(--brand-200)] text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, var(--brand-50) 0%, rgba(5,150,105,0.08) 100%)', color: 'var(--brand-800)' }}
          >
            {isDemoLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4" style={{ color: 'var(--brand-600)' }} />
            }
            Try with Demo Family (60 seconds)
          </button>
          <p className="text-center text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
            Loads Sharma family demo with a full 7-day AI meal plan — no signup needed
          </p>
        </div>
      </div>
    </motion.div>
  );
}
