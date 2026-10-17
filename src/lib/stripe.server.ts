// Community build stub. Stripe connectors, keys and webhook verification
// are private-estate concerns; nothing here touches real payment data.
// Public error formatting stays available for the UI.

export type StripeEnv = "sandbox" | "live";

export function getConnectionApiKey(_env: StripeEnv): string {
  throw new Error("Payments are unavailable in the community build.");
}

export function createStripeClient(_env: StripeEnv): never {
  throw new Error("Payments are unavailable in the community build.");
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const stripeError = error as {
      message?: string;
      type?: string;
      code?: string;
      decline_code?: string;
      param?: string;
      requestId?: string;
      raw?: {
        message?: string;
        type?: string;
        code?: string;
        decline_code?: string;
        param?: string;
        requestId?: string;
      };
    };

    const message = stripeError.raw?.message ?? stripeError.message;
    if (message) {
      const details = [
        stripeError.raw?.type ?? stripeError.type,
        stripeError.raw?.code ?? stripeError.code,
        stripeError.raw?.decline_code ?? stripeError.decline_code,
        stripeError.raw?.param ?? stripeError.param,
        stripeError.raw?.requestId ?? stripeError.requestId,
      ].filter(Boolean);
      return details.length ? `${message} (${details.join(", ")})` : message;
    }
  }

  return "Stripe request failed";
}

export async function verifyWebhook(
  _req: Request,
  _env: StripeEnv,
): Promise<{ type: string; data: { object: unknown } }> {
  throw new Error("Payment webhooks are not processed in the community build.");
}
