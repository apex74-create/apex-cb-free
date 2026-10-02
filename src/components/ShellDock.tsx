import { useCallback, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useBridge } from "@/lib/bridge-hooks";
import { SHELL_GROUPS, type ShellTool } from "@/lib/shell-tools";
import { toneClass, toneBorder } from "@/lib/tools";

/**
 * Global bridge shell.
 *
 * Mounted once at the root so every screen in the watch PWA — face, maps,
 * tools, netchat — can run real `adb shell` tools without leaving the view.
 * Output comes back from the live agent; there is no local simulation.
 */
export default function ShellDock() {
  const { state, run, retryNow } = useBridge();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(SHELL_GROUPS[0]!.key);
  const [busy, setBusy] = useState<string | null>(null);
  const [arm, setArm] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [out, setOut] = useState("");

  // The dedicated bridge screen already owns a full deck.
  const hidden = pathname.startsWith("/bridge");

  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  const exec = useCallback(
    async (tool: ShellTool) => {
      if (tool.write && arm !== tool.key) {
        setArm(tool.key);
        return;
      }
      setArm(null);
      setBusy(tool.key);
      setTitle(tool.label);
      setOut("running…");
      try {
        const text = await run(tool.cmd);
        setOut(text.trim() || "(no output)");
      } catch (err) {
        setOut(err instanceof Error ? err.message : "command failed");
      } finally {
        setBusy(null);
      }
    },
    [arm, run],
  );

  if (hidden) return null;

  const live = state === "online";
  const active = SHELL_GROUPS.find((g) => g.key === group) ?? SHELL_GROUPS[0]!;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open bridge shell"
        className={`fixed bottom-16 right-2 z-50 grid h-9 w-9 place-items-center rounded-full border bg-background/85 text-[13px] leading-none backdrop-blur-sm active:bg-accent ${
          live ? "border-signal text-signal" : "border-warn bg-warn/10 text-warn"
        }`}
        style={{ marginBottom: "var(--face-inset, 0px)", marginRight: "var(--face-inset, 0px)" }}
      >
        ▮
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border face-pad py-1.5">
        <button type="button" onClick={retryNow} className="min-w-0 text-left">
          <span
            className={`block truncate text-[10px] font-bold uppercase tracking-[0.2em] ${live ? "text-signal" : "text-warn"}`}
          >
            {live ? "● SHELL LIVE" : "○ SHELL " + state}
          </span>
          <span className="block truncate text-[8px] uppercase tracking-widest text-muted-foreground">
            {live ? "adb via bridge agent" : "tap to reconnect"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close bridge shell"
          className="shrink-0 px-1 text-[12px] leading-none text-muted-foreground active:text-signal"
        >
          ✕
        </button>
      </header>

      <nav className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-border face-pad py-1">
        {SHELL_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(g.key)}
            className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[8px] uppercase tracking-widest ${
              g.key === group ? "border-signal text-signal" : "border-border text-muted-foreground"
            }`}
          >
            {g.glyph} {g.label}
          </button>
        ))}
      </nav>

      <section className="no-scrollbar min-h-0 flex-1 overflow-y-auto face-pad py-2">
        <ul className="grid grid-cols-[repeat(var(--face-cols,2),minmax(0,1fr))] gap-1.5">
          {active.tools.map((tool) => (
            <li key={tool.key}>
              <button
                type="button"
                onClick={() => void exec(tool)}
                disabled={!live || busy !== null}
                className={`w-full rounded-sm border bg-card/70 px-2 py-2 text-left transition-colors active:bg-accent disabled:opacity-40 ${
                  arm === tool.key ? "border-alert" : toneBorder[tool.tone]
                }`}
              >
                <span
                  className={`block truncate text-[9px] font-bold uppercase tracking-widest ${toneClass[tool.tone]}`}
                >
                  {busy === tool.key ? "· " : tool.write ? "! " : ""}
                  {arm === tool.key ? "CONFIRM?" : tool.label}
                </span>
                <span className="block truncate text-[8px] tracking-wider text-muted-foreground">
                  {tool.cmd}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {out ? (
          <div className="mt-2 rounded-sm border border-border bg-card/60 p-1.5">
            <p className="mb-1 truncate text-[8px] uppercase tracking-widest text-scan">{title}</p>
            <pre className="no-scrollbar max-h-40 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-snug text-signal">
              {out}
            </pre>
          </div>
        ) : (
          <p className="mt-2 text-[8px] uppercase tracking-widest text-muted-foreground">
            pick a tool — output lands here
          </p>
        )}
      </section>
    </div>
  );
}
