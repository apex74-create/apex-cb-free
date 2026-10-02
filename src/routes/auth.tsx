import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/cloud";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) =>
    typeof s["next"] === "string" && s["next"] ? { next: s["next"] as string } : {},
  head: () => ({
    meta: [
      { title: "Sign In — Apex Signal Watch" },
      {
        name: "description",
        content:
          "Sign in to sync scans, captures and session logs between your watch, phone and tablet on one Apex account.",
      },
      { property: "og:title", content: "Sign In — Apex Signal Watch" },
      {
        property: "og:description",
        content:
          "One account links the watch, phone and tablet so every capture lands in the same place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const search = useSearch({ from: "/auth" }) as { next?: string };
  const next = search.next;
  const nav = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const dest = next && next.startsWith("/") ? next : "/";

  useEffect(() => {
    if (!loading && session) void nav({ to: dest });
  }, [loading, session, dest, nav]);

  const submit = async () => {
    setBusy(true);
    setNote("");
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: { emailRedirectTo: `${window.location.origin}${dest}` },
        });
        if (error) throw error;
        setNote("account created — check mail if confirmation is on");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "auth failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setNote("");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setNote(result.error.message ?? "google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    void nav({ to: dest });
  };

  return (
    <main className="flex h-app flex-col overflow-hidden scan-grid">
      <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-border face-pad py-1">
        <Link
          to="/app"
          aria-label="Back"
          className="text-[10px] leading-none text-muted-foreground active:text-signal"
        >
          ‹
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[10px] font-bold uppercase tracking-widest text-signal">
            Apex Account
          </h1>
          <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
            one login · watch · phone · tablet
          </p>
        </div>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto face-pad py-2">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-2 grid grid-cols-2 gap-1">
            {(["in", "up"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-sm border py-1 text-[8px] uppercase tracking-widest ${
                  mode === m ? "border-signal text-signal" : "border-border text-muted-foreground"
                }`}
              >
                {m === "in" ? "sign in" : "create"}
              </button>
            ))}
          </div>

          <label className="block pb-1.5">
            <span className="block pb-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
              email
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-sm border border-border bg-input px-1.5 py-1 text-[10px] text-foreground outline-none focus:border-scan"
            />
          </label>
          <label className="block pb-1.5">
            <span className="block pb-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
              password
            </span>
            <input
              type="password"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full rounded-sm border border-border bg-input px-1.5 py-1 text-[10px] text-foreground outline-none focus:border-scan"
            />
          </label>

          <button
            type="button"
            disabled={busy || !email || !pass}
            onClick={() => void submit()}
            className="w-full rounded-sm border border-signal py-2 text-[10px] font-bold uppercase tracking-widest text-signal active:bg-accent disabled:opacity-40"
          >
            {busy ? "working…" : mode === "up" ? "create account" : "sign in"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void google()}
            className="mt-1 w-full rounded-sm border border-scan py-2 text-[10px] uppercase tracking-widest text-scan active:bg-accent disabled:opacity-40"
          >
            continue with google
          </button>

          {note ? (
            <p className="pt-1.5 text-[8px] uppercase tracking-wider text-warn">{note}</p>
          ) : (
            <p className="pt-1.5 text-[8px] leading-snug text-muted-foreground">
              Signing in links this handset to your account. Scans captured offline flush up the
              moment the link returns.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
