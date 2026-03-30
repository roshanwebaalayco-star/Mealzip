import { useEffect } from "react";

export default function WeeklyContextPage() {
  useEffect(() => {
    window.location.replace("/meal-plan?gen=1");
  }, []);

  return null;
}
