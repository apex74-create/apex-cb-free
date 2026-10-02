/**
 * One sign-in affordance for the whole storefront.
 *
 * Driven by the live session, so a successful sign-in changes the bar
 * immediately, and signing out clears the cached protected data before the
 * session goes away.
 */

import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/cloud";

export default function AccountNav() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const email = session?.user.email ?? "";

  return (
    <nav className="flex w-full items-center justify-end gap-3 px-4 pt-3 text-[10px] uppercase tracking-widest">
      <Link to="/inventory" className="text-muted-foreground hover:text-signal">
        Inventory
      </Link>
      <Link to="/library" className="text-muted-foreground hover:text-signal">
        Papers
      </Link>
      <Link to="/pricing" className="text-muted-foreground hover:text-signal">
        Pricing
      </Link>
      <Link to="/store" className="text-muted-foreground hover:text-signal">
        Store
      </Link>
      {loading ? (
        <span className="text-muted-foreground">…</span>
      ) : session ? (
        <>
          <Link to="/account" className="text-signal hover:underline">
            {email || "My account"}
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-sm border border-border px-2 py-1 text-muted-foreground hover:border-alert hover:text-alert"
          >
            Sign out
          </button>
        </>
      ) : (
        <Link
          to="/auth"
          className="rounded-sm border border-signal/60 px-2 py-1 text-signal hover:bg-signal/10"
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}
