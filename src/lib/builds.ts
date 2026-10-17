import { z } from "zod";

export const releaseAccessSchema = z.enum(["public", "unavailable"]);
export const releaseChannelKindSchema = z.enum(["pwa", "play", "apk"]);

export const releaseChannelSchema = z.object({
  key: z.string().min(1).max(32),
  title: z.string().min(1).max(80),
  kind: releaseChannelKindSchema,
  description: z.string().min(1).max(240),
  url: z.string().trim(),
  available: z.boolean(),
  access: releaseAccessSchema,
  note: z.string().max(240),
});

export const releaseArtifactSchema = z.object({
  label: z.string().min(1).max(80),
  kind: z.enum(["apk", "aab"]),
  url: z.string().trim(),
  filePath: z.string().trim(),
  available: z.boolean(),
  access: releaseAccessSchema,
  priceUsd: z.number().min(0),
  sizeBytes: z.number().int().nonnegative().nullable(),
  sizeLabel: z.string().min(1).max(40),
  sha256: z.string().min(1).max(128).nullable(),
  note: z.string().max(240),
  updatedAt: z.string().max(80).nullable(),
});

export const releaseBuildSchema = z.object({
  version: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(240),
  releasedAt: z.string().max(80),
  features: z.array(z.string().min(1).max(64)).max(12),
  releaseNotes: z.string().min(1).max(1200),
  directDownload: releaseArtifactSchema,
});

export const buildsManifestSchema = z.object({
  app: z.object({
    name: z.string().min(1).max(80),
    liveUrl: z.string().url(),
    supportUrl: z.string().url(),
    privacyUrl: z.string().url(),
    contentUrl: z.string().url(),
  }),
  channels: z.array(releaseChannelSchema).min(1).max(8),
  builds: z.array(releaseBuildSchema).max(20),
  latest: z.string().min(1).max(40),
});

export type ReleaseAccess = z.infer<typeof releaseAccessSchema>;
export type ReleaseChannelKind = z.infer<typeof releaseChannelKindSchema>;
export type ReleaseChannel = z.infer<typeof releaseChannelSchema>;
export type ReleaseArtifact = z.infer<typeof releaseArtifactSchema>;
export type ReleaseBuild = z.infer<typeof releaseBuildSchema>;
export type BuildsManifest = z.infer<typeof buildsManifestSchema>;

export async function loadBuildsManifest(): Promise<BuildsManifest> {
  const response = await fetch("/builds-manifest.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Release manifest is unavailable");
  }
  const data = (await response.json()) as unknown;
  return buildsManifestSchema.parse(data);
}
