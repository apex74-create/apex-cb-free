import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  CONTENT_SOURCE_SUMMARY,
  emptyContentDraft,
  slugify,
  splitCsv,
  type ContentDraftInput,
  type ContentPost,
  type ContentPostSourceKind,
  type ContentPostStatus,
  type PublishTarget,
} from "@/lib/content";
import { useSession } from "@/lib/cloud";

export const Route = createFileRoute("/content")({
  head: () => ({
    meta: [
      { title: "Posts · Content — Apex Signal" },
      {
        name: "description",
        content:
          "Write field posts inside the Lovable PWA, attach Whoop recovery notes, and publish through a secure Netlify build hook.",
      },
      { property: "og:title", content: "Posts · Content — Apex Signal" },
      {
        property: "og:description",
        content:
          "Draft field notes, recovery posts and briefings from the same Apex shell that runs bridge, radar, mesh and PCAP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContentStudio,
});

type PostsResponse = {
  posts: ContentPost[];
  netlifyConfigured: boolean;
  whoopReady: boolean;
  error?: string;
};

function ContentStudio() {
  const { session, loading } = useSession();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [draft, setDraft] = useState<ContentDraftInput>(emptyContentDraft());
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [note, setNote] = useState("");
  const [netlifyConfigured, setNetlifyConfigured] = useState(false);

  const tagsValue = useMemo(() => draft.tags.join(", "), [draft.tags]);
  const sourceRefsValue = useMemo(() => draft.sourceRefs.join(", "), [draft.sourceRefs]);
  const toneClass = {
    signal: "text-signal",
    scan: "text-scan",
    warn: "text-warn",
  } as const;

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: "Bearer " + token } : {};
  }, []);

  const loadPosts = useCallback(async () => {
    if (!session) return;
    setLoadingPosts(true);
    setNote("");
    try {
      const response = await fetch("/api/content/posts", {
        headers: await authHeaders(),
      });
      const data = (await response.json()) as PostsResponse;
      if (!response.ok) throw new Error(data.error ?? "Content load failed");
      setPosts(data.posts);
      setNetlifyConfigured(data.netlifyConfigured);
      if (data.posts.length > 0) {
        setSelectedId((current) => current || data.posts[0]!.id);
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Content load failed");
    } finally {
      setLoadingPosts(false);
    }
  }, [authHeaders, session]);

  useEffect(() => {
    if (!loading && session) void loadPosts();
  }, [loading, session, loadPosts]);

  useEffect(() => {
    if (!selectedId) return;
    const selected = posts.find((post) => post.id === selectedId);
    if (!selected) return;
    setDraft({
      id: selected.id,
      title: selected.title,
      slug: selected.slug,
      excerpt: selected.excerpt,
      body: selected.body,
      status: selected.status,
      tags: selected.tags,
      sourceKind: selected.sourceKind,
      sourceRefs: selected.sourceRefs,
      whoop: selected.whoop,
      publishTarget: selected.publishTarget,
    });
  }, [posts, selectedId]);

  const resetDraft = () => {
    setSelectedId("");
    setDraft(emptyContentDraft());
    setNote("");
  };

  const saveDraft = async () => {
    if (!session) {
      setNote("sign in first to save posts");
      return;
    }
    const slug = draft.slug || slugify(draft.title);
    if (!slug) {
      setNote("enter a title first");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/content/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({ ...draft, slug }),
      });
      const data = (await response.json()) as {
        post?: ContentPost;
        error?: string;
        netlifyConfigured?: boolean;
      };
      if (!response.ok || !data.post) throw new Error(data.error ?? "Content save failed");
      setDraft({
        id: data.post.id,
        title: data.post.title,
        slug: data.post.slug,
        excerpt: data.post.excerpt,
        body: data.post.body,
        status: data.post.status,
        tags: data.post.tags,
        sourceKind: data.post.sourceKind,
        sourceRefs: data.post.sourceRefs,
        whoop: data.post.whoop,
        publishTarget: data.post.publishTarget,
      });
      setSelectedId(data.post.id);
      setNetlifyConfigured(Boolean(data.netlifyConfigured));
      await loadPosts();
      setNote("post saved");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Content save failed");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!draft.id) {
      setNote("save the post before publishing");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/content/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({ id: draft.id }),
      });
      const data = (await response.json()) as {
        post?: ContentPost;
        netlifyTriggered?: boolean;
        error?: string;
      };
      if (!response.ok || !data.post) throw new Error(data.error ?? "Publish failed");
      await loadPosts();
      setNote(data.netlifyTriggered ? "published and Netlify rebuild queued" : "published");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status: ContentPostStatus) => setDraft((prev) => ({ ...prev, status }));
  const setSourceKind = (sourceKind: ContentPostSourceKind) =>
    setDraft((prev) => ({ ...prev, sourceKind }));
  const setPublishTarget = (publishTarget: PublishTarget) =>
    setDraft((prev) => ({ ...prev, publishTarget }));

  return (
    <main className="flex h-app flex-col overflow-hidden scan-grid face-pad py-2">
      <header className="mb-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Link
          to="/"
          aria-label="Back"
          className="rounded-sm border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground active:bg-accent"
        >
          ‹
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[10px] font-bold uppercase tracking-widest text-signal">
            Posts · Content
          </h1>
          <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
            bridge + whoop + netlify
          </p>
        </div>
        {!session ? (
          <Link
            to="/auth"
            search={{ next: "/content" }}
            className="rounded-sm border border-scan px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-scan active:bg-accent"
          >
            sign in
          </Link>
        ) : (
          <button
            type="button"
            onClick={resetDraft}
            className="rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:bg-accent"
          >
            new
          </button>
        )}
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
        <section className="mb-2 rounded-sm border border-border bg-card/70 px-2 py-1.5">
          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
            This content lane keeps posts separate from the watch-tool registry, uses account auth,
            accepts Whoop recovery snapshots, and can trigger Netlify from the server.
          </p>
        </section>

        <section className="mb-2 grid grid-cols-2 gap-1">
          {CONTENT_SOURCE_SUMMARY.map((item) => (
            <div
              key={item.label}
              className="rounded-sm border border-border bg-card/70 px-1.5 py-1"
            >
              <p
                className={`text-[8px] font-bold uppercase tracking-widest ${toneClass[item.tone]}`}
              >
                {item.label}
              </p>
              <p className="text-[7px] uppercase tracking-wider text-muted-foreground">
                {item.sub}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-2 rounded-sm border border-border bg-card/70 px-2 py-1.5">
          <div className="grid grid-cols-2 gap-1">
            <div>
              <p className="text-[8px] uppercase tracking-widest text-scan">netlify</p>
              <p className="text-[7px] uppercase tracking-wider text-muted-foreground">
                {netlifyConfigured ? "hook ready on server" : "hook missing — publish stays local"}
              </p>
            </div>
            <div>
              <p className="text-[8px] uppercase tracking-widest text-warn">whoop</p>
              <p className="text-[7px] uppercase tracking-wider text-muted-foreground">
                manual snapshot fields ready now
              </p>
            </div>
          </div>
        </section>

        {session ? (
          <section className="mb-2">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[8px] uppercase tracking-widest text-scan">saved posts</h2>
              <button
                type="button"
                onClick={() => void loadPosts()}
                className="text-[7px] uppercase tracking-widest text-muted-foreground"
              >
                {loadingPosts ? "loading…" : "refresh"}
              </button>
            </div>
            <div className="grid gap-1">
              {posts.length === 0 ? (
                <p className="rounded-sm border border-border bg-card/40 px-2 py-1 text-[8px] uppercase tracking-wider text-muted-foreground">
                  no posts saved yet
                </p>
              ) : (
                posts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setSelectedId(post.id)}
                    className={`rounded-sm border px-2 py-1 text-left active:bg-accent ${
                      selectedId === post.id
                        ? "border-signal/60 bg-card/80"
                        : "border-border bg-card/50"
                    }`}
                  >
                    <p className="truncate text-[8px] font-bold uppercase tracking-widest text-signal">
                      {post.title}
                    </p>
                    <p className="truncate text-[7px] uppercase tracking-wider text-muted-foreground">
                      {post.status} · /{post.slug}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>
        ) : null}

        <section className="rounded-sm border border-signal/40 bg-card/70 px-2 py-2">
          <div className="mb-1 grid grid-cols-2 gap-1">
            <label className="block">
              <span className="block pb-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
                title
              </span>
              <Input
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                className="h-8 rounded-sm px-2 text-[10px]"
              />
            </label>
            <label className="block">
              <span className="block pb-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
                slug
              </span>
              <Input
                value={draft.slug}
                onChange={(e) => setDraft((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                className="h-8 rounded-sm px-2 text-[10px]"
                placeholder={slugify(draft.title)}
              />
            </label>
          </div>

          <label className="mb-1 block">
            <span className="block pb-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
              excerpt
            </span>
            <Textarea
              value={draft.excerpt}
              onChange={(e) => setDraft((prev) => ({ ...prev, excerpt: e.target.value }))}
              className="min-h-[68px] rounded-sm px-2 py-1 text-[10px]"
            />
          </label>

          <label className="mb-1 block">
            <span className="block pb-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
              body
            </span>
            <Textarea
              value={draft.body}
              onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
              className="min-h-[180px] rounded-sm px-2 py-1 text-[10px]"
            />
          </label>

          <div className="mb-1 grid grid-cols-2 gap-1">
            <label className="block">
              <span className="block pb-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
                tags
              </span>
              <Input
                value={tagsValue}
                onChange={(e) => setDraft((prev) => ({ ...prev, tags: splitCsv(e.target.value) }))}
                className="h-8 rounded-sm px-2 text-[10px]"
                placeholder="mesh, whoop, report"
              />
            </label>
            <label className="block">
              <span className="block pb-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
                sources
              </span>
              <Input
                value={sourceRefsValue}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, sourceRefs: splitCsv(e.target.value) }))
                }
                className="h-8 rounded-sm px-2 text-[10px]"
                placeholder="bridge, radar, whoop"
              />
            </label>
          </div>

          <div className="mb-1 grid grid-cols-3 gap-1">
            {(["draft", "ready"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatus(status)}
                className={`rounded-sm border px-1 py-1 text-[8px] uppercase tracking-widest active:bg-accent ${
                  draft.status === status
                    ? "border-signal text-signal"
                    : "border-border text-muted-foreground"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="mb-1 grid grid-cols-3 gap-1">
            {(["field-note", "briefing", "recovery"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setSourceKind(kind)}
                className={`rounded-sm border px-1 py-1 text-[8px] uppercase tracking-widest active:bg-accent ${
                  draft.sourceKind === kind
                    ? "border-scan text-scan"
                    : "border-border text-muted-foreground"
                }`}
              >
                {kind}
              </button>
            ))}
          </div>

          <div className="mb-2 grid grid-cols-2 gap-1">
            {(["netlify", "none"] as const).map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => setPublishTarget(target)}
                className={`rounded-sm border px-1 py-1 text-[8px] uppercase tracking-widest active:bg-accent ${
                  draft.publishTarget === target
                    ? "border-warn text-warn"
                    : "border-border text-muted-foreground"
                }`}
              >
                {target}
              </button>
            ))}
          </div>

          <div className="mb-1 rounded-sm border border-border bg-background/40 px-2 py-1.5">
            <p className="pb-1 text-[8px] uppercase tracking-widest text-alert">whoop snapshot</p>
            <div className="grid grid-cols-3 gap-1">
              <Input
                type="number"
                min="0"
                max="100"
                value={draft.whoop.recovery ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    whoop: {
                      ...prev.whoop,
                      recovery: e.target.value === "" ? null : Number(e.target.value),
                    },
                  }))
                }
                className="h-8 rounded-sm px-2 text-[10px]"
                placeholder="recovery"
              />
              <Input
                type="number"
                min="0"
                max="21"
                step="0.1"
                value={draft.whoop.strain ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    whoop: {
                      ...prev.whoop,
                      strain: e.target.value === "" ? null : Number(e.target.value),
                    },
                  }))
                }
                className="h-8 rounded-sm px-2 text-[10px]"
                placeholder="strain"
              />
              <Input
                type="number"
                min="0"
                max="100"
                value={draft.whoop.sleepPerformance ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    whoop: {
                      ...prev.whoop,
                      sleepPerformance: e.target.value === "" ? null : Number(e.target.value),
                    },
                  }))
                }
                className="h-8 rounded-sm px-2 text-[10px]"
                placeholder="sleep %"
              />
            </div>
            <Input
              value={draft.whoop.capturedAt}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  whoop: { ...prev.whoop, capturedAt: e.target.value },
                }))
              }
              className="mt-1 h-8 rounded-sm px-2 text-[10px]"
              placeholder="snapshot time"
            />
            <Textarea
              value={draft.whoop.note}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  whoop: { ...prev.whoop, note: e.target.value },
                }))
              }
              className="mt-1 min-h-[60px] rounded-sm px-2 py-1 text-[10px]"
              placeholder="manual Whoop note"
            />
          </div>

          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !session}
              onClick={() => void saveDraft()}
              className="h-8 rounded-sm text-[9px] uppercase tracking-widest"
            >
              {busy ? "working…" : "save"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !session || !draft.id}
              onClick={() => void publish()}
              className="h-8 rounded-sm text-[9px] uppercase tracking-widest"
            >
              publish
            </Button>
          </div>

          {note ? (
            <p className="pt-1.5 text-[8px] uppercase tracking-wider text-warn">{note}</p>
          ) : session ? (
            <p className="pt-1.5 text-[8px] uppercase tracking-wider text-muted-foreground">
              save drafts to Supabase, then publish from the same shell
            </p>
          ) : (
            <p className="pt-1.5 text-[8px] uppercase tracking-wider text-muted-foreground">
              sign in to unlock saved drafts and Netlify publish
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
