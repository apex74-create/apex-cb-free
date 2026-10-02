import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import type { ContentDraftInput, ContentPost } from "@/lib/content";

const postStatus = z.enum(["draft", "ready", "published"]);
const postSourceKind = z.enum(["field-note", "briefing", "recovery"]);
const publishTarget = z.enum(["none", "netlify"]);

const whoopSchema = z.object({
  recovery: z.number().min(0).max(100).nullable(),
  strain: z.number().min(0).max(21).nullable(),
  sleepPerformance: z.number().min(0).max(100).nullable(),
  capturedAt: z.string().max(80),
  note: z.string().max(280),
});

const draftSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(140),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().trim().max(240),
  body: z.string().trim().min(1).max(12000),
  status: postStatus,
  tags: z.array(z.string().trim().min(1).max(32)).max(12),
  sourceKind: postSourceKind,
  sourceRefs: z.array(z.string().trim().min(1).max(32)).max(12),
  whoop: whoopSchema,
  publishTarget: publishTarget,
});

type ContentRow = Database["public"]["Tables"]["content_posts"]["Row"];
type ContentInsert = Database["public"]["Tables"]["content_posts"]["Insert"];

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    const auth = headers.get("Authorization");
    if (isNewSupabaseApiKey(supabaseKey) && auth?.startsWith("Bearer ")) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function authClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireContentUser(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) {
    throw new Error("Unauthorized");
  }
  const { data, error } = await authClient().auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Error("Unauthorized");
  }
  return data.claims.sub;
}

function asStringArray(value: Json): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function mapRow(row: ContentRow): ContentPost {
  const whoop = row.whoop as Record<string, Json> | null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    status: row.status as ContentPost["status"],
    tags: row.tags ?? [],
    sourceKind: row.source_kind as ContentPost["sourceKind"],
    sourceRefs: asStringArray(row.source_refs),
    whoop: {
      recovery: typeof whoop?.["recovery"] === "number" ? whoop["recovery"] : null,
      strain: typeof whoop?.["strain"] === "number" ? whoop["strain"] : null,
      sleepPerformance:
        typeof whoop?.["sleepPerformance"] === "number" ? whoop["sleepPerformance"] : null,
      capturedAt: typeof whoop?.["capturedAt"] === "string" ? whoop["capturedAt"] : "",
      note: typeof whoop?.["note"] === "string" ? whoop["note"] : "",
    },
    publishTarget: row.publish_target as ContentPost["publishTarget"],
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listContentPosts(userId: string): Promise<ContentPost[]> {
  const { data, error } = await supabaseAdmin
    .from("content_posts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function saveContentPost(userId: string, input: unknown): Promise<ContentPost> {
  const parsed = draftSchema.parse(input) as ContentDraftInput;
  if (parsed.id) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("content_posts")
      .select("*")
      .eq("id", parsed.id)
      .eq("user_id", userId)
      .single();
    if (existingError || !existing) throw existingError ?? new Error("Post not found");
    const nextStatus = parsed.status === "published" ? "published" : parsed.status;
    const { data, error } = await supabaseAdmin
      .from("content_posts")
      .update({
        title: parsed.title,
        slug: parsed.slug,
        excerpt: parsed.excerpt,
        body: parsed.body,
        status: nextStatus,
        tags: parsed.tags,
        source_kind: parsed.sourceKind,
        source_refs: parsed.sourceRefs,
        whoop: parsed.whoop,
        publish_target: parsed.publishTarget,
        published_at:
          nextStatus === "published" ? (existing.published_at ?? new Date().toISOString()) : null,
      })
      .eq("id", parsed.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  const row: ContentInsert = {
    user_id: userId,
    title: parsed.title,
    slug: parsed.slug,
    excerpt: parsed.excerpt,
    body: parsed.body,
    status: parsed.status === "published" ? "ready" : parsed.status,
    tags: parsed.tags,
    source_kind: parsed.sourceKind,
    source_refs: parsed.sourceRefs,
    whoop: parsed.whoop,
    publish_target: parsed.publishTarget,
    published_at: null,
  };
  const { data, error } = await supabaseAdmin
    .from("content_posts")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function publishContentPost(userId: string, postId: string) {
  const { data, error } = await supabaseAdmin
    .from("content_posts")
    .select("*")
    .eq("id", postId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw error ?? new Error("Post not found");

  let netlifyTriggered = false;
  if (data.publish_target === "netlify") {
    const hook = process.env["NETLIFY_BUILD_HOOK_URL"];
    if (!hook) throw new Error("Netlify build hook is not configured");
    const response = await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        tags: data.tags,
        whoop: data.whoop,
        sourceRefs: data.source_refs,
      }),
    });
    if (!response.ok) {
      throw new Error(`Netlify publish failed (${response.status})`);
    }
    netlifyTriggered = true;
  }

  const now = new Date().toISOString();
  const { data: saved, error: updateError } = await supabaseAdmin
    .from("content_posts")
    .update({
      status: "published",
      published_at: now,
      updated_at: now,
    })
    .eq("id", postId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (updateError || !saved) throw updateError ?? new Error("Publish failed");

  return { post: mapRow(saved), netlifyTriggered };
}

export function contentIntegrationStatus() {
  return {
    netlifyConfigured: Boolean(process.env["NETLIFY_BUILD_HOOK_URL"]),
    whoopReady: true,
  };
}
