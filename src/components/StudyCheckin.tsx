import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/cloud";
import { WEATHER } from "@/lib/app-routes";

const CADENCES = [3, 6, 9] as const;

/** Free weather study: a human ground check every 3, 6 or 9 days keeps full free access. */
export function useStudyStatus() {
  const { session } = useSession();
  const [cadence, setCadence] = useState<number>(3);
  const [last, setLast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) { setReady(true); return; }
    void Promise.all([
      supabase.from("study_checkins").select("cadence_days").eq("user_id", uid).maybeSingle(),
      supabase.from("field_observations").select("created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]).then(([c, o]) => { if (c.data) setCadence(c.data.cadence_days); setLast(o.data?.created_at ?? null); setReady(true); });
  }, [uid]);
  const due = last ? new Date(new Date(last).getTime() + cadence * 864e5) : null;
  const overdue = !!uid && ready && (!due || due.getTime() < Date.now());
  const choose = async (d: number) => {
    setCadence(d);
    if (uid) await supabase.from("study_checkins").upsert({ user_id: uid, cadence_days: d });
  };
  return { signedIn: !!uid, cadence, choose, due, overdue, ready };
}

export function StudyCheckin() {
  const s = useStudyStatus();
  if (!s.ready) return null;
  return (
    <section className="mt-2 rounded-sm border border-border bg-card/60 p-2">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">free weather study · ground check rhythm</p>
      {!s.signedIn ? (
        <p className="mt-1 text-[10px] text-foreground">Free weather runs on your reports. <Link to="/auth" className="text-scan underline">Sign in</Link> to join the study.</p>
      ) : (
        <>
          <div className="mt-1 flex items-center gap-1">
            {CADENCES.map((d) => (
              <button key={d} type="button" onClick={() => void s.choose(d)} className={`rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-widest ${s.cadence === d ? "border-scan text-scan" : "border-border text-muted-foreground"}`}>every {d} days</button>
            ))}
          </div>
          <p className={`mt-1 text-[10px] ${s.overdue ? "text-warn" : "text-foreground"}`}>
            {s.overdue ? "Ground check due. You're on the basic daily view until you send one." : `Next ground check by ${s.due?.toLocaleDateString()}.`}{" "}
            <Link to={WEATHER.observe} className="text-scan underline">Send a ground check</Link>
          </p>
        </>
      )}
    </section>
  );
}
