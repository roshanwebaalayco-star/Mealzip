import { useState, useRef, useEffect, useMemo } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Loader2, CheckCircle2, ShoppingCart, Package2,
  ChefHat, Sparkles, ArrowRight, IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface PantryItem   { name: string; quantity: string; emoji: string; }
interface GroceryItem  { name: string; quantity: string; price: number; emoji: string; }
interface InventoryItem { name: string; quantity: string; source: "pantry" | "grocery"; emoji: string; }

type FlowStep = "welcome" | "uploading" | "scanning" | "scanned" | "confirmed" | "meal_ready";

/* ─── Mock data ──────────────────────────────────────────────────────────── */
const MOCK_SCANNED: PantryItem[] = [
  { name: "Tomatoes",       quantity: "300g",   emoji: "🍅" },
  { name: "Leftover Rice",  quantity: "2 cups", emoji: "🍚" },
  { name: "Raw Moong Dal",  quantity: "250g",   emoji: "🫘" },
];

const MOCK_GROCERIES: GroceryItem[] = [
  { name: "Foxtail Millet",  quantity: "500g", price: 60, emoji: "🌾" },
  { name: "Fresh Spinach",   quantity: "250g", price: 20, emoji: "🥬" },
  { name: "Onions",          quantity: "500g", price: 30, emoji: "🧅" },
  { name: "Turmeric Powder", quantity: "100g", price: 40, emoji: "🫛" },
];

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function BotBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -14, y: 6 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.32, delay }}
      className="flex gap-2.5 items-start"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 mt-0.5 shadow">
        <ChefHat className="w-4 h-4 text-white" />
      </div>
      <div className="max-w-[85%]">
        {children}
      </div>
    </motion.div>
  );
}

function BotText({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <BotBubble delay={delay}>
      <div className="bg-white/80 dark:bg-white/10 border border-white/60 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
        <p className="text-sm text-foreground leading-relaxed">{text}</p>
      </div>
    </BotBubble>
  );
}

function UserBubble({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay }}
      className="flex justify-end"
    >
      <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 shadow-sm max-w-[75%]">
        <p className="text-sm font-medium">{text}</p>
      </div>
    </motion.div>
  );
}

function ScannedItemsCard({ items }: { items: PantryItem[] }) {
  return (
    <BotBubble>
      <div className="bg-white/80 dark:bg-white/10 border border-white/60 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          <p className="text-sm font-semibold text-foreground">I scanned your kitchen! I see:</p>
        </div>
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1 px-2.5 bg-primary/5 rounded-xl">
              <span className="text-base">{item.emoji}</span>
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">{item.name}</span>
              </div>
              <Badge variant="secondary" className="text-[10px] font-semibold">{item.quantity}</Badge>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">✅ Saved to Scanned Pantry</p>
      </div>
    </BotBubble>
  );
}

function GroceryListCard({
  items, budget, onConfirm, waiting,
}: {
  items: GroceryItem[];
  budget: number;
  onConfirm: () => void;
  waiting: boolean;
}) {
  const total = items.reduce((s, i) => s + i.price, 0);
  return (
    <BotBubble>
      <div className="bg-white/80 dark:bg-white/10 border border-white/60 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm space-y-3">
        <p className="text-sm leading-snug text-foreground">
          To make healthy meals for your family this week under your{" "}
          <span className="font-bold text-primary">₹{budget} budget</span>, here is your{" "}
          <span className="font-semibold">Kirana Grocery List:</span>
        </p>

        <div className="rounded-xl border border-primary/15 overflow-hidden">
          <div className="bg-primary/5 px-3 py-1.5 flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Grocery Items</span>
          </div>
          <div className="divide-y divide-black/5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <span className="text-lg">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity}</p>
                </div>
                <div className="flex items-center gap-0.5 text-sm font-bold text-primary shrink-0">
                  <IndianRupee className="w-3 h-3" />
                  {item.price}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-primary/5 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total</span>
            <div className="flex items-center gap-0.5 text-sm font-bold text-primary">
              <IndianRupee className="w-3 h-3" />
              {total}
            </div>
          </div>
        </div>

        {waiting && (
          <Button
            size="default"
            className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white shadow-md"
            onClick={onConfirm}
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm Purchase
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Button>
        )}
        {!waiting && (
          <div className="flex items-center gap-2 text-xs text-green-700 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Purchase confirmed
          </div>
        )}
      </div>
    </BotBubble>
  );
}

function InventoryCard({ items }: { items: InventoryItem[] }) {
  const pantryItems  = items.filter(i => i.source === "pantry");
  const groceryItems = items.filter(i => i.source === "grocery");
  return (
    <BotBubble>
      <div className="bg-white/80 dark:bg-white/10 border border-white/60 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Package2 className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm font-semibold text-foreground">Great! Your inventory is updated. Let's cook. 🎉</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-2.5">
            <p className="text-[10px] font-semibold text-blue-600 uppercase mb-1.5">🏠 From Pantry</p>
            {pantryItems.map((it, i) => (
              <p key={i} className="text-xs text-foreground flex items-center gap-1">
                <span>{it.emoji}</span> {it.name}
                <span className="text-muted-foreground ml-auto">{it.quantity}</span>
              </p>
            ))}
          </div>
          <div className="rounded-xl bg-green-50 border border-green-100 p-2.5">
            <p className="text-[10px] font-semibold text-green-600 uppercase mb-1.5">🛒 Just Bought</p>
            {groceryItems.map((it, i) => (
              <p key={i} className="text-xs text-foreground flex items-center gap-1">
                <span>{it.emoji}</span> {it.name}
                <span className="text-muted-foreground ml-auto">{it.quantity}</span>
              </p>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">✅ MasterInventory saved · {items.length} items ready</p>
      </div>
    </BotBubble>
  );
}

interface MealPlate { memberLabel: string; icon: string; modification: string; }
function OneManyPlatesCard({ baseDish, baseHindi, baseDescription, plates }: {
  baseDish: string; baseHindi: string; baseDescription: string; plates: MealPlate[];
}) {
  return (
    <BotBubble>
      <div className="bg-white/80 dark:bg-white/10 border border-white/60 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm font-bold text-foreground">One Base, Many Plates 🍽️</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-3 space-y-1">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">🫕 Base Dish</p>
          <p className="text-base font-bold text-foreground">{baseDish}</p>
          <p className="text-xs text-amber-700 font-medium">{baseHindi}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{baseDescription}</p>
        </div>

        <div className="space-y-2">
          {plates.map((plate, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * i }}
              className="rounded-xl border border-primary/10 bg-primary/3 p-2.5 flex gap-2.5"
            >
              <span className="text-xl shrink-0 mt-0.5">{plate.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground mb-0.5">{plate.memberLabel}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{plate.modification}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-green-700 font-semibold pt-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Generated from your MasterInventory · ICMR-NIN 2024 balanced
        </div>
      </div>
    </BotBubble>
  );
}

/* ─── Scanning animation ─────────────────────────────────────────────────── */
function ScanningBubble() {
  return (
    <BotBubble>
      <div className="bg-white/80 dark:bg-white/10 border border-white/60 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Scanning your kitchen…</p>
            <p className="text-xs text-muted-foreground">AI Vision identifying ingredients</p>
          </div>
        </div>
        <div className="mt-2.5 w-full h-1.5 bg-primary/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "linear" }}
          />
        </div>
      </div>
    </BotBubble>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function PantryScan() {
  const { activeFamily } = useAppState();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  const [flowStep, setFlowStep] = useState<FlowStep>("welcome");
  const [scannedPantry,   setScannedPantry]   = useState<PantryItem[]>([]);
  const [pendingGroceries] = useState<GroceryItem[]>(MOCK_GROCERIES);
  const [masterInventory, setMasterInventory] = useState<InventoryItem[]>([]);

  const familyBudget = activeFamily?.monthlyBudget
    ? Math.round(Number(activeFamily.monthlyBudget) / 4)
    : 1500;

  const familyMembers = useMemo(() => {
    return [
      {
        memberLabel: "Papa (Diabetic)",
        icon: "👨",
        modification:
          "Low-GI millet base, no added salt or ghee. Extra spinach for fibre. Tomato rasam on the side.",
      },
      {
        memberLabel: "Teen (Anaemic)",
        icon: "👧",
        modification:
          "Same khichdi with extra spinach stirred in, a squeeze of lemon for iron absorption, and a tablespoon of peanut chutney.",
      },
      {
        memberLabel: "Everyone else",
        icon: "👨‍👩‍👧",
        modification: "Regular serving with a dollop of ghee and achaar on the side.",
      },
    ];
  }, []);

  /* Auto-scroll to bottom when new messages appear */
  useEffect(() => {
    const el = bottomRef.current;
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [flowStep]);

  /* Handle file upload → trigger mock scan */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setFlowStep("uploading");

    setTimeout(() => {
      setFlowStep("scanning");
      setTimeout(() => {
        setScannedPantry(MOCK_SCANNED);
        setFlowStep("scanned");
      }, 2000);
    }, 300);

    e.target.value = "";
  };

  /* Handle Confirm Purchase */
  const handleConfirmPurchase = () => {
    const merged: InventoryItem[] = [
      ...scannedPantry.map(i => ({ ...i, source: "pantry" as const })),
      ...pendingGroceries.map(i => ({ name: i.name, quantity: i.quantity, emoji: i.emoji, source: "grocery" as const })),
    ];
    setMasterInventory(merged);
    setFlowStep("confirmed");

    setTimeout(() => setFlowStep("meal_ready"), 800);
  };

  const steps: FlowStep[] = ["welcome", "uploading", "scanning", "scanned", "confirmed", "meal_ready"];
  const stepIdx = steps.indexOf(flowStep);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Package2 className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">
            {t("Weekly Kitchen Scan", "साप्ताहिक किचन स्कैन")}
          </h1>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-1 mt-2">
          {["📸", "🔍", "🛒", "✅", "🍽️"].map((icon, i) => (
            <div key={i} className="flex-1 flex items-center gap-1">
              <div
                className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                  stepIdx > i ? "bg-primary" : stepIdx === i ? "bg-primary/50" : "bg-primary/10"
                }`}
              />
              {i === 4 && (
                <span className="text-xs">{icon}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat area — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* Step 1 — Welcome */}
        <BotText
          text={`Namaste${activeFamily ? ` ${activeFamily.name} family` : ""}! 🙏 Let's plan your week smartly. Please upload a photo of your current kitchen or fridge so I can see what you already have at home.`}
        />

        {/* Upload button — only before scan */}
        {["welcome", "uploading"].includes(flowStep) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <Button
              size="default"
              className="gap-2 shadow-md"
              onClick={() => fileInputRef.current?.click()}
              disabled={flowStep === "uploading"}
            >
              {flowStep === "uploading" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              ) : (
                <><Camera className="w-4 h-4" /> 📸 Upload Kitchen Photo</>
              )}
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </motion.div>
        )}

        {/* Step 2 — User uploaded */}
        {stepIdx >= 2 && (
          <UserBubble text="📸 Photo uploaded" />
        )}

        {/* Step 2 — Scanning */}
        {flowStep === "scanning" && <ScanningBubble />}

        {/* Step 3 — Scanned items */}
        {stepIdx >= 3 && scannedPantry.length > 0 && (
          <ScannedItemsCard items={scannedPantry} />
        )}

        {/* Step 3 — Grocery list (shown immediately after scan) */}
        {stepIdx >= 3 && (
          <AnimatePresence>
            <motion.div
              key="grocery"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <GroceryListCard
                items={pendingGroceries}
                budget={familyBudget}
                onConfirm={handleConfirmPurchase}
                waiting={flowStep === "scanned"}
              />
            </motion.div>
          </AnimatePresence>
        )}

        {/* Step 4 — User confirmed */}
        {stepIdx >= 4 && (
          <UserBubble text="✅ Confirm Purchase" delay={0.1} />
        )}

        {/* Step 4 — Inventory updated */}
        {stepIdx >= 4 && masterInventory.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <InventoryCard items={masterInventory} />
          </motion.div>
        )}

        {/* Step 5 — Meal generation loading */}
        {flowStep === "confirmed" && (
          <BotBubble>
            <div className="bg-white/80 border border-white/60 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              <p className="text-sm text-muted-foreground">Generating your personalised meal…</p>
            </div>
          </BotBubble>
        )}

        {/* Step 5 — One Base Many Plates */}
        {flowStep === "meal_ready" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <OneManyPlatesCard
              baseDish="Millet Moong Dal Khichdi"
              baseHindi="बाजरा मूंग दाल खिचड़ी"
              baseDescription="One pot — foxtail millet + moong dal + tomatoes + spinach cooked together. Budget: ₹110 for the whole family."
              plates={familyMembers}
            />
          </motion.div>
        )}

        {/* Bottom anchor for auto-scroll */}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Bottom hint */}
      <div className="px-4 pb-4 pt-1 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground">
          {flowStep === "welcome" && "Upload a photo to begin · All data stays on your device"}
          {flowStep === "scanned" && "⬆ Review your Kirana List above and click Confirm Purchase to continue"}
          {flowStep === "meal_ready" && "✅ Meal generated from your MasterInventory · ICMR-NIN 2024 balanced"}
        </p>
      </div>
    </div>
  );
}
