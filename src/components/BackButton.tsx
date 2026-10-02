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
  if (isCbPath(pathname)) return null;

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
      className="fixed left-1 top-1/2 z-50 grid h-9 min-w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/85 px-2 text-[11px] leading-none text-muted-foreground opacity-80 backdrop-blur-sm active:bg-accent"
    >
      ‹ back
    </Button>
  );
}
