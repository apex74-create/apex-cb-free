// Community build: payment webhooks are not processed here.
// The real fulfilment route lives in the private Apex estate.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async () => {
        return Response.json({
          received: true,
          ignored: "payments are not processed in the community build",
        });
      },
    },
  },
});
