import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, CalendarDays, BookOpen, MessageSquareText, Sprout, ShoppingCart, BarChart3, Heart, LogIn, LogOut, UserCircle, Users } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useAuth } from "@/hooks/use-auth";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { activeFamily } = useAppState();
  const { lang, toggleLang } = useLanguage();
  const { user, logout } = useAuth();

  const navItems = [
    { icon: Home, label: "Home", labelHi: "होम", href: "/" },
    { icon: CalendarDays, label: "Meals", labelHi: "भोजन", href: "/meal-plan" },
    { icon: ShoppingCart, label: "Grocery", labelHi: "किराना", href: "/grocery" },
    { icon: BarChart3, label: "Nutrition", labelHi: "पोषण", href: "/nutrition" },
    { icon: Heart, label: "Health", labelHi: "स्वास्थ्य", href: "/health" },
    { icon: Users, label: "Profile", labelHi: "प्रोफाइल", href: "/profile" },
    { icon: BookOpen, label: "Recipes", labelHi: "रेसिपी", href: "/recipes" },
    { icon: MessageSquareText, label: "AI Chat", labelHi: "AI चैट", href: "/chat" },
  ];

  const mobileNavItems = navItems.slice(0, 5);

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-64 flex flex-col bg-background">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 glass-sidebar z-50">
        {/* Logo */}
        <div className="px-6 pt-7 pb-5 flex items-center gap-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/90 to-orange-500 shadow-lg shadow-primary/30">
            <Sprout className="w-6 h-6 text-white" />
            <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.30) 0%,transparent 55%)' }} />
          </div>
          <div>
            <h1 className="font-display font-bold text-[1.12rem] leading-tight text-foreground">NutriNext</h1>
            <p className="text-[0.65rem] text-muted-foreground font-semibold uppercase tracking-[0.12em] mt-0.5">ParivarSehat AI</p>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="px-5 pb-3">
          <button
            onClick={toggleLang}
            className="w-full glass-card rounded-2xl px-4 py-2.5 flex items-center justify-between hover:bg-white/60 transition-all"
          >
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Language</span>
            <span className="text-sm font-bold text-foreground">{lang === "en" ? "🇮🇳 हिंदी" : "🌐 English"}</span>
          </button>
        </div>

        {/* Family pill */}
        <div className="px-5 pb-4">
          {activeFamily ? (
            <div className="glass-card rounded-2xl px-4 py-3">
              <p className="text-[0.6rem] text-primary font-bold uppercase tracking-[0.14em] mb-0.5">Active Family</p>
              <h3 className="font-display font-semibold text-foreground text-sm relative z-10">{activeFamily.name}</h3>
            </div>
          ) : (
            <div className="rounded-2xl px-4 py-3 bg-muted/40 border border-border/50 text-center">
              <p className="text-xs text-muted-foreground">No family selected</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl font-medium text-sm transition-all duration-200 focus-ring relative ${
                  isActive
                    ? "nav-active text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/60"
                }`}
              >
                <item.icon className={`w-[1.1rem] h-[1.1rem] shrink-0 ${isActive ? "text-white" : ""}`} />
                <span className="relative z-10">{lang === "hi" ? item.labelHi : item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User / Auth Footer */}
        <div className="px-5 py-5 space-y-2">
          {user ? (
            <div className="glass-card rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2.5">
                <UserCircle className="w-7 h-7 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                  <p className="text-[0.6rem] text-muted-foreground truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => logout()}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <Link href="/login" className="block">
              <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-2.5 hover:bg-white/60 transition-all cursor-pointer">
                <LogIn className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Log In / Sign Up</span>
              </div>
            </Link>
          )}
          <div className="glass-card rounded-2xl px-4 py-2.5 text-center">
            <p className="text-[0.6rem] text-muted-foreground leading-relaxed relative z-10">
              Powered by <span className="font-semibold text-foreground/70">Gemini AI</span> &amp;{" "}
              <span className="font-semibold text-secondary">ICMR-NIN 2024</span>
            </p>
          </div>
        </div>
      </aside>

      {/* ── Mobile Top Bar ── */}
      <header className="md:hidden glass-panel sticky top-0 z-40 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-orange-500 shadow shadow-primary/30">
            <Sprout className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-display font-bold text-base text-foreground">NutriNext</h1>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          {activeFamily && (
            <div className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
              {activeFamily.name}
            </div>
          )}
          <button
            onClick={toggleLang}
            className="text-xs font-bold px-2.5 py-1 rounded-full border border-border bg-background/50"
          >
            {lang === "en" ? "हिं" : "EN"}
          </button>
          {user ? (
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-full border border-border bg-background/50 text-muted-foreground hover:text-destructive transition-colors"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <Link href="/login">
              <div className="p-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary">
                <LogIn className="w-3.5 h-3.5" />
              </div>
            </Link>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto page-enter">
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <div className="md:hidden fixed bottom-5 left-4 right-4 z-50">
        <nav className="glass-nav-pill rounded-[2rem] px-2 py-2 flex justify-around items-center">
          {mobileNavItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center min-w-[3.2rem] h-13 rounded-[1.5rem] transition-all duration-250 focus-ring ${
                  isActive
                    ? "nav-active text-white px-3 gap-0.5"
                    : "text-muted-foreground hover:text-foreground px-2"
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : ""}`} />
                {isActive && (
                  <span className="text-[0.55rem] font-semibold text-white leading-none">
                    {lang === "hi" ? item.labelHi : item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
