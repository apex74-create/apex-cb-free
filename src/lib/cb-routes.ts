import { APP_DOMAINS } from "./app-routes";
/**
 * Single source of truth for every Sovereign CB address.
 * Add or move a CB page here, never as a loose string in a screen.
 */
export const CB_ROUTES = {
  /** Shareable hero page (send this link). */
  entry: "/cb-welcome",
  /** The installed radio; the CB icon always opens here. */
  radio: "/cb",
  /** Multicolor sun/moon face (static page). */
  face: "/w",
  /** Small wrist radio opened by the watch face's PTT button. */
  wrist: "/wcb",
  /** Baked single-file Lokmat CB edition (radar + PTT, no framework). */
  lokmat: "/lcb.html",
  sales: "/store",
} as const;

export const CB_SHARE_URL = `${APP_DOMAINS.cb}${CB_ROUTES.entry}`;
export const CB_OG_IMAGE = `${APP_DOMAINS.cb}/og-cb.jpg`;

/** Pages that wear the CB icon, manifest and no global back button. */
export function isCbPath(path: string) {
  return path === CB_ROUTES.radio || path === CB_ROUTES.entry || path === CB_ROUTES.wrist;
}
