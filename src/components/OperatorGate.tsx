import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useSession } from "@/lib/cloud";
import { useOperatorAccess } from "@/lib/use-operator-access";

export default function OperatorGate({ children }: { children: ReactNode }) {
  const { loading } = useSession();
  const allowed = useOperatorAccess();
  if (loading) return <main className="p-6 text-sm text-muted-foreground">Checking operator licence…</main>;
  if (!allowed) return <main className="p-6 text-sm text-muted-foreground">An operator licence is required for these tools. <Link to="/app" className="text-signal underline">Back to Signal Watch</Link></main>;
  return <>{children}</>;
}