// Community build: content publishing writes are not available.
// The full implementation lives in the private Apex estate. Author identity
// verification against a publishable endpoint stays, so callers fail closed.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ContentPost } from "@/lib/content";

function authClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createClient<Database>(url, key, {
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

export async function listContentPosts(_userId: string): Promise<ContentPost[]> {
  throw new Error("Content publishing is unavailable in the community build.");
}

export async function saveContentPost(_userId: string, _input: unknown): Promise<ContentPost> {
  throw new Error("Content publishing is unavailable in the community build.");
}

export async function publishContentPost(_userId: string, _postId: string): Promise<never> {
  throw new Error("Content publishing is unavailable in the community build.");
}

export function contentIntegrationStatus() {
  return {
    netlifyConfigured: false,
    whoopReady: true,
  };
}
