import { motion } from "framer-motion";

interface HarmonyScoreProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
}

export function HarmonyScore({ score, size = "md" }: HarmonyScoreProps) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getStrokeColor = (s: number) => {
    if (s >= 80) return "url(#harmonyGradGreen)";
    if (s >= 60) return "url(#harmonyGradAmber)";
    return "url(#harmonyGradRose)";
  };

  const getGlowColor = (s: number) => {
    if (s >= 80) return "rgba(52,211,153,0.30)";
    if (s >= 60) return "rgba(251,191,36,0.30)";
    return "rgba(248,113,113,0.30)";
  };

  const getTextColor = (s: number) => {
    if (s >= 80) return "text-emerald-600";
    if (s >= 60) return "text-amber-600";
    return "text-rose-600";
  };

  const getTierLabel = (s: number) => {
    if (s >= 85) return "Harmonious";
    if (s >= 65) return "Manageable";
    if (s >= 40) return "Challenging";
    return "Complex";
  };

  const sizeMap = {
    sm:  { wrap: "w-14 h-14",   text: "text-base",  sub: false },
    md:  { wrap: "w-24 h-24",   text: "text-2xl",   sub: true  },
    lg:  { wrap: "w-32 h-32",   text: "text-4xl",   sub: true  },
    xl:  { wrap: "w-48 h-48",   text: "text-6xl",   sub: true  },
  };
  const { wrap, text, sub } = sizeMap[size];

  return (
    <div
      className={`relative flex items-center justify-center ${wrap}`}
      style={{
        filter: `drop-shadow(0 0 14px ${getGlowColor(score)})`,
      }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id="harmonyGradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="harmonyGradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="harmonyGradRose" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <filter id="glowFilter">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Glass disc bg */}
        <circle cx="50" cy="50" r="48" fill="rgba(255,255,255,0.55)" />
        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1" />

        {/* Specular highlight arc at top */}
        <path
          d="M 22 30 A 32 32 0 0 1 78 30"
          fill="none"
          stroke="rgba(255,255,255,0.50)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Track */}
        <circle
          cx="50" cy="50" r={r}
          stroke="rgba(0,0,0,0.07)"
          strokeWidth="7"
          fill="transparent"
          transform="rotate(-90 50 50)"
        />

        {/* Progress arc */}
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.6, ease: [0.32, 0.72, 0, 1] }}
          cx="50" cy="50" r={r}
          stroke={getStrokeColor(score)}
          strokeWidth="7"
          fill="transparent"
          strokeDasharray={circumference}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          filter="url(#glowFilter)"
        />
      </svg>

      {/* Score text */}
      <div className={`relative z-10 flex flex-col items-center justify-center font-sans ${getTextColor(score)}`}>
        <span className={`font-bold leading-none ${text}`}>{score}</span>
        {sub && (
          <>
            <span className="text-[0.22em] font-semibold opacity-55 uppercase tracking-[0.18em] mt-1">
              Score
            </span>
            <span className="text-[0.18em] font-semibold opacity-60 tracking-[0.10em] mt-0.5 whitespace-nowrap">
              {getTierLabel(score)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
