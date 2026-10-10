import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';


// Demo floor for the 'sample-show' gate code when no published row exists. Display-only.
const SAMPLE_SHOW = {
  event: { id: 'demo', code: 'sample-show', title: 'Rock Event Mesh', summary: 'Demonstration layout. Vendors and stages are examples, not a real show.', floor_width_m: 120, floor_depth_m: 80, overlay_url: null as string | null, ticket_url: null as string | null, swag_text: null as string | null, swag_url: null as string | null, visibility: 'listed', starts_at: null as string | null, ends_at: null as string | null, banner_title: null as string | null, banner_tagline: null as string | null, banner_image_url: null as string | null },
  places: [
    { id: 'p-stage', kind: 'stage', label: 'Main Stage', x_m: 60, z_m: 10, description: 'Headliner stage' as string | null },
    { id: 'p-gate', kind: 'gate', label: 'Gate A', x_m: 10, z_m: 72, description: 'Entry and QR' },
    { id: 'p-pick1', kind: 'pickup', label: 'Pickup Booth', x_m: 100, z_m: 66, description: 'Staffed pickup' },
    { id: 'p-water', kind: 'service', label: 'Water', x_m: 34, z_m: 40, description: 'Free refills' },
  ],
  vendors: [
    { id: 'v-merch', name: 'Tour Merch', description: 'Shirts and posters' as string | null, x_m: 30, z_m: 24 },
    { id: 'v-vinyl', name: 'Vinyl Bin', description: 'Records and tapes', x_m: 88, z_m: 30 },
    { id: 'v-food', name: 'Smokehouse', description: 'BBQ and drinks', x_m: 56, z_m: 52 },
    { id: 'v-leather', name: 'Leather & Studs', description: 'Jackets and belts', x_m: 76, z_m: 62 },
  ],
  schedule: [
    { id: 's1', title: 'Doors open', starts_at: '2026-10-10T17:00:00Z', ends_at: null as string | null, location: 'Gate A' as string | null },
    { id: 's2', title: 'Headliner', starts_at: '2026-10-10T21:00:00Z', ends_at: '2026-10-10T23:00:00Z', location: 'Main Stage' },
  ],
  items: [
    { id: 'demo-stage', kind: 'main stage', label: 'Main Stage', x_m: 60, z_m: 10, rot_deg: 0, w_m: 28, d_m: 14, layer: 'public' },
    { id: 'demo-side', kind: 'side stage', label: 'Side Stage', x_m: 95, z_m: 15, rot_deg: -25, w_m: 14, d_m: 10, layer: 'public' },
    { id: 'demo-road', kind: 'road', label: 'Promenade', x_m: 58, z_m: 42, rot_deg: 0, w_m: 95, d_m: 5, layer: 'public' },
    { id: 'demo-router', kind: 'wifi router', label: 'Router', x_m: 70, z_m: 50, rot_deg: 0, w_m: 2, d_m: 2, layer: 'public' },
    { id: 'demo-observe', kind: 'observation pad', label: 'Sky Watch', x_m: 17, z_m: 27, rot_deg: 0, w_m: 12, d_m: 12, layer: 'public' },
  ],
  listings: [
    { id: 'l1', vendor_id: 'v-merch', title: 'Tour tee', description: 'Black, all sizes' as string | null, available: true },
    { id: 'l2', vendor_id: 'v-vinyl', title: 'Live LP', description: 'Limited pressing', available: true },
    { id: 'l3', vendor_id: 'v-food', title: 'Brisket plate', description: 'Pickup at counter', available: true },
    { id: 'l4', vendor_id: 'v-leather', title: 'Studded belt', description: 'One of a kind', available: true },
  ],
};

export type EventFloor = Awaited<ReturnType<typeof getEventFloor>>;

export const getEventFloor = createServerFn({ method: 'GET' })
  .inputValidator((input: { code: string }) => z.object({ code: z.string().regex(/^[a-z0-9-]{3,40}$/) }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
    const db = createClient<Database>(process.env['SUPABASE_URL']!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data: event, error } = await db.from('cast_events').select('id,code,title,summary,floor_width_m,floor_depth_m,overlay_url,snapshot_url,starts_at,ends_at,ticket_url,swag_text,swag_url,visibility,banner_title,banner_tagline,banner_image_url').eq('code', data.code).eq('status', 'published').maybeSingle();
    if (error) throw error;
    if (!event) return data.code === 'sample-show' ? SAMPLE_SHOW : null;
    const [places, vendors, schedule, items] = await Promise.all([
      db.from('cast_places').select('id,kind,label,x_m,z_m,description').eq('event_id', event.id),
      db.from('cast_vendors').select('id,name,description,x_m,z_m').eq('event_id', event.id).eq('status', 'approved'),
      db.from('cast_schedule').select('id,title,starts_at,ends_at,location').eq('event_id', event.id).order('starts_at'),
       db.from('cast_floor_items').select('id,kind,label,x_m,z_m,rot_deg,w_m,d_m,layer').eq('event_id', event.id).order('sort_order'),
    ]);
    if (places.error || vendors.error || schedule.error || items.error) throw places.error ?? vendors.error ?? schedule.error ?? items.error;
    const vendorIds = (vendors.data ?? []).map(v => v.id);
    const listings = vendorIds.length ? await db.from('cast_listings').select('id,vendor_id,title,description,available').in('vendor_id', vendorIds).eq('available', true) : { data: [], error: null };
    if (listings.error) throw listings.error;
    return { event, places: places.data ?? [], vendors: vendors.data ?? [], schedule: schedule.data ?? [], items: items.data ?? [], listings: listings.data ?? [] } as unknown as typeof SAMPLE_SHOW;
  });

export const listPublishedEvents = createServerFn({ method: 'GET' }).handler(async () => {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  const db = createClient<Database>(process.env['SUPABASE_URL']!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await db.from('cast_events').select('id,code,title,summary,banner_title,banner_image_url,starts_at,created_at,site_lat,site_lon').eq('status', 'published').eq('visibility', 'listed').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
});
