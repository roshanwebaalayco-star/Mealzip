import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { scoreThaliCompleteness, THALI_CATEGORIES, type ThaliScore } from "@/lib/thali-scorer";
import { useLanguage } from "@/contexts/language-context";

interface ThaliScoreBadgeProps {
  meal: {
    recipeName?: string;
    base_dish_name?: string;
    name?: string;
    nameHindi?: string;
    ingredients?: string[] | string;
    base_ingredients?: Array<{ ingredient: string; qty_grams?: number }>;
  };
  compact?: boolean;
}

export default function ThaliScoreBadge({ meal, compact = false }: ThaliScoreBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const { lang, t } = useLanguage();

  const result: ThaliScore = scoreThaliCompleteness(meal);
  const { score, present, missing, suggestions } = result;

  const colorClass =
    score >= 4
      ? "bg-green-50 text-green-700 border-green-200"
      : score === 3
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";

  const dotColor =
    score >= 4 ? "bg-green-500" : score === 3 ? "bg-amber-500" : "bg-red-500";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${colorClass}`}
        title={`Thali Score: ${score}/5`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {score}/5
      </span>
    );
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(prev => !prev);
        }}
        className={`inline-flex items-center gap-1.5 text-[9px] font-semibold px-2 py-1 rounded-xl border transition-colors hover:opacity-80 ${colorClass}`}
      >
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span>{t("Thali", "थाली")} {score}/5</span>
        <span className="flex gap-0.5">
          {THALI_CATEGORIES.map((cat) => (
            <span
              key={cat.key}
              className={`text-[10px] ${present.includes(cat.key) ? "opacity-100" : "opacity-25"}`}
              title={lang === "hi" ? cat.labelHi : cat.label}
            >
              {cat.icon}
            </span>
          ))}
        </span>
        {missing.length > 0 && (
          expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {expanded && suggestions.length > 0 && (
        <div className="mt-1.5 space-y-1 ml-1">
          {suggestions.map((sug) => {
            const cat = THALI_CATEGORIES.find(c => c.key === sug.category);
            return (
              <div
                key={sug.category}
                className="flex items-start gap-1.5 text-[9px] text-muted-foreground bg-muted/30 border border-border/30 rounded-lg px-2 py-1"
              >
                <span className="shrink-0 opacity-50">{cat?.icon}</span>
                <span>
                  <span className="font-medium text-foreground/70">
                    + {lang === "hi" ? sug.hi : sug.en}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
