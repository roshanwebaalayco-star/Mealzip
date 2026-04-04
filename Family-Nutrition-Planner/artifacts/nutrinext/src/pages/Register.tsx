import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const LANGUAGES = [
  { value: "hindi", label: "हिंदी (Hindi)" },
  { value: "english", label: "English" },
  { value: "bengali", label: "বাংলা (Bengali)" },
  { value: "tamil", label: "தமிழ் (Tamil)" },
  { value: "telugu", label: "తెలుగు (Telugu)" },
  { value: "marathi", label: "मराठी (Marathi)" },
  { value: "gujarati", label: "ગુજરાતી (Gujarati)" },
  { value: "kannada", label: "ಕನ್ನಡ (Kannada)" },
  { value: "malayalam", label: "മലയാളം (Malayalam)" },
  { value: "punjabi", label: "ਪੰਜਾਬੀ (Punjabi)" },
];

function getPasswordStrength(pwd: string): { level: "weak" | "medium" | "strong"; label: string } {
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const long = pwd.length >= 8;
  if (!long || (!hasUpper && !hasNumber)) return { level: "weak", label: "Weak" };
  if (long && (hasUpper || hasNumber) && !(hasUpper && hasNumber)) return { level: "medium", label: "Medium" };
  if (long && hasUpper && hasNumber) return { level: "strong", label: "Strong" };
  return { level: "weak", label: "Weak" };
}

export default function Register() {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [primaryLanguage, setPrimaryLanguage] = useState("hindi");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { register } = useAuth();
  const [, navigate] = useLocation();

  const pwdStrength = password ? getPasswordStrength(password) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Full name is required");
      return;
    }
    if (!email || !password) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all required fields." });
      return;
    }
    if (password.length < 8) {
      toast({ variant: "destructive", title: "Error", description: "Password must be at least 8 characters." });
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast({ variant: "destructive", title: "Error", description: "Password must contain at least one uppercase letter." });
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast({ variant: "destructive", title: "Error", description: "Password must contain at least one number." });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Error", description: "Passwords do not match." });
      return;
    }
    setIsLoading(true);
    try {
      await register(email.trim(), password, name, primaryLanguage);
      navigate("/family-setup");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      toast({ variant: "destructive", title: "Registration Failed", description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const strengthColors = {
    weak: { bars: 1, color: "bg-red-500", text: "text-red-600" },
    medium: { bars: 2, color: "bg-orange-400", text: "text-orange-600" },
    strong: { bars: 3, color: "bg-green-500", text: "text-green-600" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center p-6 min-h-[82vh] animate-fade-up"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl glass-elevated flex items-center justify-center mx-auto mb-4">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="ParivarSehat"
              className="w-10 h-10 object-contain"
            />
          </div>
          <h1 className="font-semibold text-2xl" style={{ letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            Create Account<span style={{ color: 'var(--brand-400)' }}> ·</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>Start your family's nutrition journey</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-elevated rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Rajesh Sharma"
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
              onBlur={() => { if (!name.trim()) setNameError("Full name is required"); }}
              maxLength={100}
              autoComplete="name"
              className={`input-glass rounded-xl ${nameError ? "border-red-400" : ""}`}
            />
            {nameError && <p className="text-xs text-red-500 mt-0.5">{nameError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => setEmail(e.target.value.trim())}
              autoComplete="email"
              className="input-glass rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="language">Preferred Language</Label>
            <Select value={primaryLanguage} onValueChange={setPrimaryLanguage}>
              <SelectTrigger className="input-glass rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
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
            {pwdStrength && (
              <div className="mt-1.5 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        n <= strengthColors[pwdStrength.level].bars
                          ? strengthColors[pwdStrength.level].color
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${strengthColors[pwdStrength.level].text}`}>
                  {pwdStrength.label} — needs at least 8 characters, 1 uppercase letter, 1 number
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="input-glass rounded-xl"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive mt-1">Passwords do not match</p>
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

        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--brand-400)' }}>
            Log in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
