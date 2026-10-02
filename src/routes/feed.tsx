import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/cloud";

type ForecastPost = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  created_at: string;
  user_id: string;
  slug: string;
};

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Lovely Forecast Posts — TinyRadr" },
      {
        name: "description",
        content: "Community weather forecast feed with shareable cards and saved outlook history.",
      },
      { property: "og:title", content: "Lovely Forecast Posts — TinyRadr" },
      {
        property: "og:description",
        content:
          "Read and share wave-forecast outlooks with location snapshots and peak-date highlights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeedRoute,
});

function FeedRoute() {
  const { session } = useSession();
  const [posts, setPosts] = useState<ForecastPost[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const loadPosts = useCallback(async () => {
    let query = supabase
      .from("content_posts")
      .select("id,title,excerpt,body,created_at,user_id,slug")
      .eq("source_kind", "forecast");

    query = session?.user?.id
      ? query.or(`status.eq.published,and(status.eq.draft,user_id.eq.${session.user.id})`)
      : query.eq("status", "published");

    const { data, error } = await query.order("created_at", { ascending: false }).limit(30);
    if (error) {
      setNote(error.message);
      return;
    }
    setPosts((data ?? []) as ForecastPost[]);
  }, [session?.user?.id]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const publish = async () => {
    if (!session || !title.trim() || !body.trim()) return;
    setBusy(true);
    setNote("");
    const slug = `forecast-${Date.now()}`;
    const excerpt = body.slice(0, 140);
    const { error } = await supabase.from("content_posts").insert({
      title: title.trim(),
      body: body.trim(),
      excerpt,
      slug,
      user_id: session.user.id,
      source_kind: "forecast",
      publish_target: "feed",
      source_refs: {},
      whoop: {},
      status: "draft",
      tags: ["forecast"],
    });
    if (error) {
      setNote(error.message);
      setBusy(false);
      return;
    }
    setTitle("");
    setBody("");
    setBusy(false);
    setNote("post saved as draft");
    await loadPosts();
  };

  return (
    <main className="no-scrollbar h-app overflow-y-auto scan-grid face-pad pb-4 pt-2">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Link to="/forecast" className="text-[10px] text-muted-foreground">
          ‹
        </Link>
        <h1 className="truncate text-center text-[10px] font-bold uppercase tracking-[0.2em] text-signal">
          Lovely Posts
        </h1>
        <span className="text-[7px] uppercase tracking-widest text-muted-foreground">
          {posts.length}
        </span>
      </header>

      <section className="mt-2 rounded-sm border border-border bg-card/60 p-2">
        <p className="text-[8px] uppercase tracking-widest text-muted-foreground">
          community forecasts · social-ready cards
        </p>
        {session ? (
          <div className="mt-2 space-y-1.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="forecast title"
              className="w-full rounded-sm border border-border bg-background px-2 py-1 text-[10px] text-foreground outline-none focus:border-signal"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="share your forecast and peak date..."
              rows={3}
              className="w-full rounded-sm border border-border bg-background px-2 py-1 text-[10px] text-foreground outline-none focus:border-signal"
            />
            <button
              type="button"
              disabled={busy || !title.trim() || !body.trim()}
              onClick={() => void publish()}
              className="w-full rounded-sm border border-signal/60 py-1.5 text-[8px] font-bold uppercase tracking-widest text-signal disabled:border-border disabled:text-muted-foreground"
            >
              {busy ? "publishing…" : "publish forecast post"}
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            search={{ next: "/feed" }}
            className="mt-2 block rounded-sm border border-scan/60 py-1.5 text-center text-[8px] uppercase tracking-widest text-scan"
          >
            sign in to post
          </Link>
        )}
      </section>

      {note ? (
        <p className="mt-2 rounded-sm border border-warn/50 bg-card/60 px-2 py-1 text-[8px] uppercase tracking-widest text-warn">
          {note}
        </p>
      ) : null}

      <ul className="mt-2 space-y-1.5">
        {posts.map((post) => (
          <li key={post.id} className="rounded-sm border border-border bg-card/60 p-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-signal">
              {post.title}
            </p>
            <p className="mt-1 text-[8px] leading-relaxed text-muted-foreground">{post.excerpt}</p>
            <p className="mt-1 text-[7px] uppercase tracking-widest text-muted-foreground">
              {new Date(post.created_at).toLocaleDateString()} · @{post.user_id.slice(0, 8)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
