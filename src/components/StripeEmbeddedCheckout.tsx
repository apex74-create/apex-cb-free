import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

interface Props {
  priceId: string;
  productSlug: string;
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
}

export default function StripeEmbeddedCheckout({
  priceId,
  productSlug,
  customerEmail,
  userId,
  returnUrl,
}: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createCheckoutSession({
      data: {
        priceId,
        productSlug,
        ...(customerEmail ? { customerEmail } : {}),
        ...(userId ? { userId } : {}),
        returnUrl: returnUrl || window.location.href,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Checkout could not be started");
    return result.clientSecret;
  };

  return (
    <div id="checkout" className="mt-4">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
