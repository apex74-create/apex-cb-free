import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { getEventFloor } from '@/lib/cast-event.functions';
import { recentEventCodes } from '@/lib/event-identity';
import defaultBanner from '@/assets/event-banner-default.jpg';
import rockStage from '@/assets/vendor-mesh-glam-stage.jpg';

export function RecentEventFloors() {
  const [codes, setCodes] = useState<string[]>([]);
  useEffect(() => { setCodes(recentEventCodes()); }, []);
  const { data = [] } = useQuery({
    queryKey: ['recent-mesh-floors', codes],
    enabled: codes.length > 0,
    queryFn: async () => (await Promise.all(codes.map(async code => {
      try {
        const floor = await getEventFloor({ data: { code } });
        return floor ? { code, title: floor.event.title, image: floor.event.banner_image_url || (code === 'sample-show' ? rockStage : defaultBanner) } : null;
      } catch { return null; }
    }))).filter((floor): floor is { code: string; title: string; image: string } => floor !== null),
    staleTime: 30_000,
  });
  if (!data.length) return null;
  return <section className="mx-auto max-w-6xl px-4 py-7 sm:px-8" aria-label="Recently opened events">
    <h2 className="mb-3 text-sm font-bold uppercase text-warn">Your recent floors</h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.map(floor => <Link key={floor.code} to="/event/$code" params={{ code: floor.code }} className="group relative min-h-36 overflow-hidden border border-border bg-card">
      <img src={floor.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3"><span className="block text-base font-bold text-foreground">{floor.title}</span><span className="text-[11px] text-warn">Open saved floor ↗</span></div>
    </Link>)}</div>
  </section>;
}