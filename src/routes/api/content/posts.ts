import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/content/posts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const mod = await import("@/lib/content.server");
          const userId = await mod.requireContentUser(request);
          const posts = await mod.listContentPosts(userId);
          return Response.json({ posts, ...mod.contentIntegrationStatus() });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Content load failed" },
            { status: 401 },
          );
        }
      },
      POST: async ({ request }) => {
        try {
          const mod = await import("@/lib/content.server");
          const userId = await mod.requireContentUser(request);
          const input = await request.json();
          const post = await mod.saveContentPost(userId, input);
          return Response.json({ post, ...mod.contentIntegrationStatus() });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Content save failed";
          const status = message === "Unauthorized" ? 401 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
