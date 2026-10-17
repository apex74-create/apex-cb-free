/**
 * Rooms: step off the calling channel into a side room, and from there
 * spawn a locked private room only invited handsets can read.
 */
import { useEffect, useState } from "react";
import {
  childRoomId,
  loadRooms,
  parseInvite,
  removeRoom,
  roomChannel,
  roomCode,
  roomInvite,
  upsertRoom,
  type Room,
} from "@/lib/rooms";

type Props = {
  channel: number;
  active: string;
  onSelect: (id: string) => void;
};

export function RoomsPanel({ channel, active, onSelect }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [msg, setMsg] = useState("");
  const [paste, setPaste] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => setRooms(loadRooms()), []);

  const mine = rooms.filter((r) => roomChannel(r.id) === channel);
  const base = String(channel);

  const addRoom = (locked: boolean) => {
    const parent = active.includes(".") ? active : base;
    const id = childRoomId(parent, rooms.map((r) => r.id));
    const room: Room = locked
      ? { id, channel, label: `ROOM ${id}`, code: roomCode() }
      : { id, channel, label: `ROOM ${id}` };
    setRooms(upsertRoom(room));
    onSelect(id);
    setMsg(locked ? "locked room open — share the invite" : "side room open");
  };

  const share = async (r: Room) => {
    const text = roomInvite(r);
    try {
      const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
      if (nav.share) await nav.share({ text });
      else await navigator.clipboard.writeText(text);
      setMsg("invite ready to send");
    } catch {
      setMsg(text);
    }
  };

  const join = () => {
    const r = parseInvite(paste);
    if (!r) return setMsg("that invite was not readable");
    setRooms(upsertRoom(r));
    onSelect(r.id);
    setPaste("");
    setMsg(`joined ${r.id}`);
  };

  const drop = (id: string) => {
    setRooms(removeRoom(id));
    if (active === id) onSelect(base);
  };

  return (
    <section className="mb-2 rounded-sm border border-border bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-1.5 py-1 text-[16px] uppercase tracking-widest text-muted-foreground"
      >
        <span>
          rooms · on {active}
          {active.includes(".") ? " · side room" : " · calling channel"}
        </span>
        <span className="ml-2 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="space-y-1 border-t border-border px-1.5 py-1.5">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onSelect(base)}
              className={`rounded-sm border px-1.5 py-1 text-[18px] tracking-widest ${
                active === base ? "border-signal bg-signal/15 text-signal" : "border-border text-muted-foreground"
              }`}
            >
              {base} calling
            </button>
            {mine.map((r) => (
              <span key={r.id} className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  className={`rounded-sm border px-1.5 py-1 text-[18px] tracking-widest ${
                    active === r.id
                      ? "border-signal bg-signal/15 text-signal"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {r.id}
                  {r.code ? " 🔒" : ""}
                </button>
                {r.code ? (
                  <button
                    type="button"
                    onClick={() => void share(r)}
                    className="rounded-sm border border-border px-1 py-1 text-[16px] uppercase tracking-widest text-muted-foreground"
                  >
                    invite
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => drop(r.id)}
                  aria-label={`leave ${r.id}`}
                  className="rounded-sm border border-border px-1 py-1 text-[16px] text-muted-foreground"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => addRoom(false)}
              className="flex-1 rounded-sm border border-border px-1.5 py-1 text-[16px] uppercase tracking-widest text-muted-foreground active:text-signal"
            >
              step aside
            </button>
            <button
              type="button"
              onClick={() => addRoom(true)}
              className="flex-1 rounded-sm border border-signal/60 px-1.5 py-1 text-[16px] uppercase tracking-widest text-signal active:bg-accent"
            >
              locked room
            </button>
          </div>

          <div className="flex gap-1">
            <input
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="paste an invite"
              className="min-w-0 flex-1 rounded-sm border border-border bg-card/70 px-1.5 py-1 text-[18px] text-foreground outline-none focus:border-signal/60"
            />
            <button
              type="button"
              onClick={join}
              className="rounded-sm border border-border px-2 text-[18px] uppercase tracking-widest text-muted-foreground active:text-signal"
            >
              join
            </button>
          </div>

          {msg ? (
            <p className="break-all text-[16px] uppercase tracking-wider text-warn">{msg}</p>
          ) : (
            <p className="text-[16px] uppercase tracking-wider text-muted-foreground">
              locked rooms are encrypted over wi-fi, bluetooth and usb
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
