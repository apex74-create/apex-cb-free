const SEGMENTS: Record<string, string> = {
  "0": "abcedf", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc",
  "5": "afgcd", "6": "afgecd", "7": "abc", "8": "abcdefg", "9": "abfgcd",
};

export function CbLedDigits({ value, label }: { value: number; label: string }) {
  const digits = String(Math.max(0, Math.min(999, value))).padStart(3, "0");
  return <div className="cb-led-readout" role="img" aria-label={label}>
    {digits.split("").map((digit, index) => <span className="cb-led-digit" key={index} aria-hidden="true">
      {"abcdefg".split("").map((segment) => <span key={segment} className={`cb-led-segment cb-led-${segment}${SEGMENTS[digit]?.includes(segment) ? " cb-led-on" : ""}`} />)}
    </span>)}
  </div>;
}