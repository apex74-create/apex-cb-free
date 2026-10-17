import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/content/publish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const mod = await import("@/lib/content.server");
          const userId = await mod.requireContentUser(request);
          const body = (await request.json()) as { id?: string };
          if (!body.id) {
            return Response.json({ error: "Missing post id" }, { status: 400 });
          }
          const result = await mod.publishContentPost(userId, body.id);
          return Response.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Publish failed";
          const status = message === "Unauthorized" ? 401 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
