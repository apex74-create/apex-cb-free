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
import { OPERATOR, SHARED } from "@/lib/app-routes";
import { useOperatorAccess } from "@/lib/use-operator-access";

export default function AccountNav() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const operator = useOperatorAccess();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const email = session?.user.email ?? "";

  return (
    <nav className="flex w-full items-center justify-end gap-3 px-4 pt-3 text-[10px] uppercase tracking-widest">
      <Link to="/library" className="text-muted-foreground hover:text-signal">
        Papers
      </Link>
      <Link to={SHARED.pricing} className="text-muted-foreground hover:text-signal">
        Pricing
      </Link>
      <Link to={SHARED.store} className="text-muted-foreground hover:text-signal">
        Store
      </Link>
      {loading ? (
        <span className="text-muted-foreground">…</span>
      ) : session ? (
        <>
          {operator ? (
          <details className="relative">
            <summary className="cursor-pointer list-none text-muted-foreground hover:text-signal">Operator</summary>
            <div className="absolute right-0 z-50 mt-1 grid min-w-36 gap-1 rounded-sm border border-border bg-card p-2">
              <Link to={OPERATOR.inventory} className="hover:text-signal">Inventory</Link>
              <Link to={OPERATOR.assembly} className="hover:text-signal">Assembly</Link>
              <Link to={OPERATOR.diag} className="hover:text-signal">Diagnostics</Link>
              <Link to={OPERATOR.hardware} className="hover:text-signal">Hardware</Link>
              <Link to={OPERATOR.perms} className="hover:text-signal">Permissions</Link>
              <Link to={OPERATOR.pcap} className="hover:text-signal">Packet capture</Link>
              <Link to={OPERATOR.playReadiness} className="hover:text-signal">Play readiness</Link>
              <Link to={OPERATOR.admin} className="hover:text-signal">Admin</Link>
            </div>
          </details>
          ) : null}
          <Link to={SHARED.account} className="text-signal hover:underline">
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
          to={SHARED.auth}
          className="rounded-sm border border-signal/60 px-2 py-1 text-signal hover:bg-signal/10"
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}
