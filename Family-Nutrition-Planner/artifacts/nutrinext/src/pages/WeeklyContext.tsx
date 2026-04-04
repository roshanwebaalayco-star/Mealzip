import { useEffect } from "react";
import { useLocation } from "wouter";

export default function WeeklyContextPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/meal-plan?openContext=1");
  }, [setLocation]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground">Redirecting to meal plan...</p>
    </div>
  );
}
