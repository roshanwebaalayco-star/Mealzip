import { useState, useEffect } from "react";
import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, CalendarDays, BookOpen, MessageSquareText, Sprout, ShoppingCart, BarChart3, Heart, LogIn, LogOut, UserCircle, Users, MoreHorizontal, X, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useAuth } from "@/hooks/use-auth";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { activeFamily } = useAppState();
  const { lang, toggleLang } = useLanguage();
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = moreOpen ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [moreOpen]);

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

  const mobileMainItems = [
    { icon: Home, label: "Home", labelHi: "होम", href: "/" },
    { icon: CalendarDays, label: "Meals", labelHi: "भोजन", href: "/meal-plan" },
    { icon: MessageSquareText, label: "AI Chat", labelHi: "AI चैट", href: "/chat" },
    { icon: BarChart3, label: "Nutrition", labelHi: "पोषण", href: "/nutrition" },
  ];

  const moreItems = [
    { icon: Heart, label: "Health", labelHi: "स्वास्थ्य", href: "/health" },
    { icon: ShoppingCart, label: "Grocery", labelHi: "किराना", href: "/grocery" },
    { icon: BookOpen, label: "Recipes", labelHi: "रेसिपी", href: "/recipes" },
    { icon: Users, label: "Profile", labelHi: "प्रोफाइल", href: "/profile" },
  ];

  const moreIsActive = moreItems.some((i) => i.href === location);

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
            <span className="text-sm font-bold text-foreground">{lang === "en" ? "🌐 English" : "🇮🇳 हिंदी"}</span>
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
      <div className={`md:hidden fixed bottom-5 left-4 right-4 z-50 transition-opacity duration-200 ${moreOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <nav className="glass-nav-pill rounded-[2rem] px-2 py-2 flex justify-around items-center">
          {mobileMainItems.map((item) => {
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

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`relative flex flex-col items-center justify-center min-w-[3.2rem] h-13 rounded-[1.5rem] transition-all duration-250 focus-ring ${
              moreIsActive
                ? "nav-active text-white px-3 gap-0.5"
                : "text-muted-foreground hover:text-foreground px-2"
            }`}
          >
            <MoreHorizontal className={`w-5 h-5 shrink-0 ${moreIsActive ? "text-white" : ""}`} />
            {moreIsActive && (
              <span className="text-[0.55rem] font-semibold text-white leading-none">
                {lang === "hi" ? "अधिक" : "More"}
              </span>
            )}
            {!moreIsActive && (
              <span className="text-[0.55rem] font-semibold leading-none mt-0.5">
                {lang === "hi" ? "अधिक" : "More"}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* ── More Bottom Sheet ── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-[70] glass-panel rounded-t-3xl px-4 pt-2.5 shadow-2xl"
              style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            >
              {/* Handle */}
              <div className="w-8 h-1 rounded-full bg-border mx-auto mb-3" />

              {/* Close button */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {lang === "hi" ? "सभी विकल्प" : "All Options"}
                </span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-1 rounded-full bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* More nav items grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {moreItems.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-all ${
                        isActive
                          ? "nav-active text-white"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      }`}
                    >
                      <item.icon className={`w-[1.1rem] h-[1.1rem] ${isActive ? "text-white" : ""}`} />
                      <span className="text-[0.6rem] font-medium leading-none">
                        {lang === "hi" ? item.labelHi : item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="border-t border-border/40 mb-2.5" />

              {/* Language toggle + Auth */}
              <div className="flex items-center gap-2 px-0.5">
                <button
                  onClick={() => { toggleLang(); setMoreOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-muted/40 hover:bg-muted/70 transition-colors text-xs font-medium text-foreground flex-1"
                >
                  <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{lang === "en" ? "Switch to हिंदी" : "Switch to English"}</span>
                </button>

                {user ? (
                  <button
                    onClick={() => { logout(); setMoreOpen(false); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-destructive/10 hover:bg-destructive/20 transition-colors text-xs font-medium text-destructive shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{lang === "hi" ? "लॉग आउट" : "Log out"}</span>
                  </button>
                ) : (
                  <Link href="/login" onClick={() => setMoreOpen(false)}>
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-medium text-primary shrink-0">
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{lang === "hi" ? "लॉग इन" : "Log in"}</span>
                    </div>
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
