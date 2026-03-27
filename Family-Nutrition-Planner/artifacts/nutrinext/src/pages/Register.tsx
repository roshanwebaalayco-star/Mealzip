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

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [primaryLanguage, setPrimaryLanguage] = useState("hindi");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { register } = useAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all required fields." });
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
      await register(email, password, name, primaryLanguage);
      navigate("/family-setup");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      toast({ variant: "destructive", title: "Registration Failed", description: msg });
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
          <h1 className="font-display font-bold text-2xl text-foreground">Create Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Start your family's nutrition journey</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Rajesh Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="rounded-xl"
            />
          </div>

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
            <Label htmlFor="language">Preferred Language</Label>
            <Select value={primaryLanguage} onValueChange={setPrimaryLanguage}>
              <SelectTrigger className="rounded-xl">
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
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="rounded-xl"
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl h-11 font-semibold"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
