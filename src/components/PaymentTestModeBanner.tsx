const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"];

export default function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-warn/40 bg-warn/10 px-4 py-1.5 text-center text-[10px] uppercase tracking-widest text-warn">
        Card payment is not finished setting up — checkout is unavailable.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-warn/40 bg-warn/10 px-4 py-1.5 text-center text-[10px] uppercase tracking-widest text-warn">
        Test mode — cards are not charged. Use 4242 4242 4242 4242.
      </div>
    );
  }
  return null;
}
