import { createFileRoute } from "@tanstack/react-router";

/**
 * Download entitlement check. Replaces the Copilot-merged Netlify function so
 * the endpoint exists on the edge runtime this project actually deploys to.
 */
export const Route = createFileRoute("/api/public/check-access")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        const version = url.searchParams.get("version");

        if (!userId || !version) {
          return Response.json({ error: "Missing userId or version parameter" }, { status: 400 });
        }

        const env = process.env["NODE_ENV"] ?? "development";
        if (env !== "production") {
          return Response.json({
            userId,
            version,
            hasAccess: true,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          });
        }

        // Default deny until the payment gateway is wired.
        return Response.json({ userId, version, hasAccess: false });
      },
    },
  },
});
