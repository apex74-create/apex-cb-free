import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  answerInvite,
  createInvite,
  leaveMesh,
  meshSupported,
  onPeerCount,
} from "@/lib/field-mesh";
import { connectUsb, disconnectUsb, usbSupport, type UsbState } from "@/lib/usb-bridge";

type Step = "idle" | "showInvite" | "scanReply" | "scanInvite" | "showReply";

/** Field links: no-server phone mesh (QR pairing) + USB radio cable. */
export function FieldLinksPanel() {
  const [open, setOpen] = useState(false);
  const [peers, setPeers] = useState(0);
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState("");
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");
  const [usb, setUsb] = useState<UsbState>("idle");
  const acceptRef = useRef<((r: string) => Promise<void>) | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => onPeerCount(setPeers), []);

  useEffect(() => {
    if (!code) return setQr("");
    void QRCode.toDataURL(code, { errorCorrectionLevel: "L", margin: 1, width: 320 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [code]);

  const invite = async () => {
    setMsg("");
    const inv = await createInvite();
    acceptRef.current = inv.accept;
    setCode(inv.code);
    setStep("showInvite");
  };

  const submit = async (value: string) => {
    const v = value.trim();
    if (!v) return;
    try {
      if (step === "scanReply" || step === "showInvite") {
        await acceptRef.current?.(v);
        setStep("idle");
        setCode("");
        setMsg("linking…");
      } else {
        setCode(await answerInvite(v));
        setStep("showReply");
      }
      setPaste("");
    } catch {
      setMsg("that code didn't read — try again");
    }
  };

  const scan = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (globalThis as any).BarcodeDetector;
    if (!BD) return setMsg("camera scan not supported here — paste the code instead");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setScanning(true);
      const det = new BD({ formats: ["qr_code"] });
      await new Promise((r) => setTimeout(r, 50));
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      const stop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setScanning(false);
      };
      const tick = async () => {
        if (!v.srcObject) return;
        const hits = await det.detect(v).catch(() => []);
        if (hits[0]?.rawValue) {
          stop();
          void submit(hits[0].rawValue);
        } else requestAnimationFrame(() => void tick());
      };
      void tick();
      setTimeout(stop, 30000);
    } catch {
      setMsg("camera blocked — allow it in site settings, or paste the code");
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setMsg("code copied");
    } catch {
      setMsg("copy blocked — show the QR instead");
    }
  };

  const btn =
    "rounded-sm border border-border px-2 py-1 text-[16px] uppercase tracking-widest text-muted-foreground active:text-signal";
  const usbMode = usbSupport();

  return (
    <div className="mb-2 rounded-sm border border-border bg-card/40 p-1.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <span className="text-[16px] uppercase tracking-widest text-signal">
          field links · {peers} phone{peers === 1 ? "" : "s"} · usb {usb === "linked" ? "on" : "off"}
        </span>
        <span className="text-[18px] text-muted-foreground">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="mt-1.5 space-y-1.5">
          <p className="text-[16px] leading-snug text-muted-foreground">
            No internet? Phones on the same Wi-Fi or hotspot link straight to each other. They're
            encrypted and don't go through a server. Any linked phone can invite the next one.
          </p>

          {!meshSupported() ? (
            <p className="text-[16px] text-warn">this browser can't do direct phone links</p>
          ) : step === "idle" ? (
            <div className="flex flex-wrap gap-1">
              <button type="button" className={btn} onClick={() => void invite()}>
                invite a phone
              </button>
              <button type="button" className={btn} onClick={() => setStep("scanInvite")}>
                join with a code
              </button>
              {peers > 0 ? (
                <button type="button" className={btn} onClick={leaveMesh}>
                  leave
                </button>
              ) : null}
            </div>
          ) : null}

          {(step === "showInvite" || step === "showReply") && code ? (
            <div className="space-y-1 text-center">
              <p className="text-[16px] uppercase tracking-widest text-signal">
                {step === "showInvite" ? "1 · other phone scans this" : "2 · show this back to the inviter"}
              </p>
              {qr ? <img src={qr} alt="pairing code" className="mx-auto w-40 rounded-sm bg-foreground p-1" /> : null}
              <div className="flex justify-center gap-1">
                <button type="button" className={btn} onClick={() => void share()}>
                  copy code
                </button>
                {step === "showInvite" ? (
                  <button type="button" className={btn} onClick={() => setStep("scanReply")}>
                    scan their reply
                  </button>
                ) : (
                  <button type="button" className={btn} onClick={() => { setStep("idle"); setCode(""); }}>
                    done
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {step === "scanInvite" || step === "scanReply" ? (
            <div className="space-y-1">
              <p className="text-[16px] uppercase tracking-widest text-signal">
                {step === "scanInvite" ? "scan the inviter's code" : "3 · scan the reply code"}
              </p>
              {scanning ? <video ref={videoRef} muted playsInline className="w-full rounded-sm" /> : null}
              <div className="flex gap-1">
                <button type="button" className={btn} onClick={() => void scan()}>
                  camera
                </button>
                <input
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder="or paste code"
                  className="min-w-0 flex-1 rounded-sm border border-border bg-card/70 px-1.5 text-[16px] text-foreground outline-none"
                />
                <button type="button" className={btn} onClick={() => void submit(paste)}>
                  ok
                </button>
              </div>
              <button type="button" className={btn} onClick={() => setStep("idle")}>
                cancel
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-1 border-t border-border pt-1.5">
            <span className="min-w-0 flex-1 truncate text-[16px] uppercase tracking-widest text-muted-foreground">
              usb radio · {usbMode === "none" ? "not supported here" : usb}
            </span>
            {usbMode !== "none" ? (
              usb === "linked" ? (
                <button type="button" className={btn} onClick={() => { disconnectUsb(); setUsb("idle"); }}>
                  unplug
                </button>
              ) : (
                <button
                  type="button"
                  className={btn}
                  onClick={() => void connectUsb((s, m) => { setUsb(s); if (m) setMsg(m); })}
                >
                  plug in radio
                </button>
              )
            ) : null}
          </div>
          <p className="text-[14px] leading-snug text-muted-foreground">
            CB radio rules forbid encrypted messages, so anything a radio node transmits on CB goes out
            in the clear. Only the phone-to-phone links are encrypted.
          </p>
          {msg ? <p className="text-[16px] uppercase tracking-wider text-warn">{msg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
