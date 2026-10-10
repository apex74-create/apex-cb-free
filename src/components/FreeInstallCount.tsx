import { useEffect, useState } from "react";
import { readConfirmedFreeInstalls } from "@/lib/free-install-count";

export default function FreeInstallCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => void readConfirmedFreeInstalls().then((value) => {
      if (active) setCount(value);
    });
    refresh();
    window.addEventListener("apex-free-install-recorded", refresh);
    return () => {
      active = false;
      window.removeEventListener("apex-free-install-recorded", refresh);
    };
  }, []);

  return (
    <p className="text-[10px] text-muted-foreground" aria-live="polite">
      Reported free web installs: <strong className="text-signal">{count === null ? "—" : count.toLocaleString()}</strong>
    </p>
  );
}