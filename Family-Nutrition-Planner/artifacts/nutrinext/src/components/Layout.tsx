import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { CalendarDays, MessageSquareText, Sprout, ShoppingCart, LogIn, LogOut, UserCircle, Users, Globe, Stethoscope } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useAuth } from "@/hooks/use-auth";
import { useLanguageStore } from "@/store/useLanguageStore";
import { INDIAN_LANGUAGES } from "@/lib/languages";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { activeFamily } = useAppState();
  const { lang } = useLanguage();
  const { user, logout } = useAuth();
  const { currentLanguage, setLanguage } = useLanguageStore();

  const navItems = [
    { icon: Users, label: "Profile", labelHi: "प्रोफाइल", href: "/profile" },
    { icon: CalendarDays, label: "Meal Plan", labelHi: "भोजन योजना", href: "/meal-plan" },
    { icon: ShoppingCart, label: "Grocery", labelHi: "किराना", href: "/grocery" },
    { icon: MessageSquareText, label: "AI Chat", labelHi: "AI चैट", href: "/chat" },
    { icon: Stethoscope, label: "Clinical Insights", labelHi: "नैदानिक जानकारी", href: "/health" },
  ];

  const mobileMainItems = [
    { icon: CalendarDays, label: "Meal Plan", labelHi: "भोजन योजना", href: "/meal-plan" },
    { icon: ShoppingCart, label: "Grocery", labelHi: "किराना", href: "/grocery" },
    { icon: MessageSquareText, label: "AI Chat", labelHi: "AI चैट", href: "/chat" },
    { icon: Stethoscope, label: "Insights", labelHi: "जानकारी", href: "/health" },
  ];

  return (
    <div className="gradient-mesh min-h-screen pb-24 md:pb-0 md:pl-64 flex flex-col">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 glass-sidebar z-50">
        {/* Logo */}
        <Link href="/" className="px-6 pt-7 pb-5 flex items-center gap-3 no-underline">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg" style={{ boxShadow: '0 4px 16px rgba(5, 150, 105, 0.30)' }}>
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-[1.12rem] leading-tight" style={{ letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
              NutriNext<span style={{ color: 'var(--brand-400)' }}> ·</span>
            </h1>
            <p className="label-caps mt-0.5">ParivarSehat AI</p>
          </div>
        </Link>

        {/* Family pill */}
        <div className="px-5 pb-4">
          {activeFamily ? (
            <div className="glass-card rounded-2xl px-4 py-3">
              <p className="text-[11px] text-primary font-bold uppercase tracking-[0.14em] mb-0.5">Active Family</p>
              <h3 className="font-medium text-sm relative z-10" style={{ color: 'var(--text-primary)' }}>{activeFamily.name}</h3>
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
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition-all duration-200 focus-ring relative ${
                  isActive
                    ? "nav-active text-white font-medium"
                    : "font-normal hover:bg-black/[0.04]"
                }`}
                style={isActive ? {} : { color: 'var(--text-tertiary)', fontWeight: 450 }}
              >
                <item.icon className={`w-[1.1rem] h-[1.1rem] shrink-0 ${isActive ? "text-white" : ""}`} />
                <span className="relative z-10">{lang === "hi" ? item.labelHi : item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Language Switcher */}
        <div className="px-5 pb-2">
          <label className="flex items-center gap-2 glass-card rounded-2xl px-3 py-2.5 cursor-pointer">
            <Globe className="w-4 h-4 text-primary shrink-0" />
            <select
              value={currentLanguage}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex-1 bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer appearance-none"
            >
              {INDIAN_LANGUAGES.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* User / Auth Footer */}
        <div className="px-5 py-5 space-y-2">
          {user ? (
            <div className="glass-card rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2.5">
                <UserCircle className="w-7 h-7 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
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
            <p className="text-[11px] text-muted-foreground leading-relaxed relative z-10">
              Powered by <span className="font-semibold text-foreground/70">Gemini AI</span> &amp;{" "}
              <span className="font-semibold text-secondary">ICMR-NIN 2024</span>
            </p>
          </div>
        </div>
      </aside>

      {/* ── Mobile Top Bar ── */}
      <header className="md:hidden glass-elevated sticky top-0 z-40 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 relative z-10 shrink-0 no-underline">
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow shadow-emerald-500/30">
            <Sprout className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <h1 className="font-semibold text-sm sm:text-base" style={{ color: 'var(--text-primary)' }}>NutriNext</h1>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2 relative z-10 min-w-0">
          {activeFamily && (
            <div className="text-[10px] sm:text-xs font-semibold bg-primary/10 text-primary px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-primary/20 truncate max-w-[120px] sm:max-w-[160px]">
              {activeFamily.name}
            </div>
          )}
          <label className="relative flex items-center p-2 sm:p-2 rounded-full border border-border bg-background/50 shrink-0">
            <Globe className="w-5 h-5 text-primary shrink-0" />
            <select
              value={currentLanguage}
              onChange={(e) => setLanguage(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {INDIAN_LANGUAGES.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <Link href="/profile">
            <div className="p-2 sm:p-2 rounded-full border border-border bg-background/50 text-muted-foreground hover:text-primary transition-colors shrink-0">
              <UserCircle className="w-5 h-5" />
            </div>
          </Link>
          {user ? (
            <button
              onClick={() => logout()}
              className="p-2 sm:p-2 rounded-full border border-border bg-background/50 text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title="Log out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <Link href="/login">
              <div className="p-2 sm:p-2 rounded-full border border-primary/40 bg-primary/10 text-primary shrink-0">
                <LogIn className="w-5 h-5" />
              </div>
            </Link>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col w-full max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 page-enter">
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <div className="md:hidden fixed bottom-5 left-4 right-4 z-50">
        <nav className="glass-nav-pill rounded-[2rem] px-2 py-2 flex justify-around items-center">
          {mobileMainItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center min-w-[2.8rem] sm:min-w-[3.2rem] h-12 sm:h-13 rounded-[1.2rem] sm:rounded-[1.5rem] transition-all duration-250 focus-ring ${
                  isActive
                    ? "nav-active text-white px-2.5 sm:px-3 gap-0.5"
                    : "text-muted-foreground hover:text-foreground px-1.5 sm:px-2"
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] sm:w-5 sm:h-5 shrink-0 ${isActive ? "text-white" : ""}`} />
                {isActive && (
                  <span className="text-[9px] sm:text-[11px] font-semibold text-white leading-none whitespace-nowrap">
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
