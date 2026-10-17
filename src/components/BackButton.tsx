import { useEffect, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { isCbPath } from "@/lib/cb-routes";

/**
 * Global escape hatch.
 *
 * Every page except the home page gets this. If there is somewhere to go back
 * to it goes back; if the page was opened cold — a shared link, a bookmark, an
 * installed shortcut — it goes home instead, so it can never be a dead end.
 *
 * Bottom-left, opposite the tool dock, clear of every page header.
 */
export default function BackButton() {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => setEmbedded(window.self !== window.top), []);
  if (embedded || isCbPath(pathname)) return null;

  const goBack = () => {
    const canGoBack =
      typeof window !== "undefined" && window.history.length > 1 && document.referrer !== "";
    if (canGoBack || (typeof window !== "undefined" && window.history.length > 1)) {
      router.history.back();
      return;
    }
    void router.navigate({ to: "/" });
  };

  return (
    <Button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      className="fixed bottom-4 left-2 z-50 grid h-7 min-w-7 place-items-center rounded-full border border-border/60 bg-background/40 px-2 text-[10px] leading-none text-muted-foreground opacity-70 backdrop-blur-sm active:bg-accent"
    >
      ‹ back
    </Button>
  );
}
