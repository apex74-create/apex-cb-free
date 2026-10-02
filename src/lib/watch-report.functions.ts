import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ReportInput = z.object({
  watchModel: z.string().max(120).nullable(),
  osVersion: z.string().max(120).nullable(),
  browser: z.string().max(120).nullable(),
  symptom: z.string().min(1).max(60),
  pagesThatWork: z.string().max(600).nullable(),
  notes: z.string().max(4000).nullable(),
  recordingPath: z.string().max(400).nullable(),
  frames: z.array(z.string().max(2_000_000)).max(3),
  profile: z.record(z.string(), z.unknown()),
});

const Diagnosis = z.object({
  primaryCause: z.enum(["sizing", "rendering", "display-sleep", "script-crash", "network", "unclear"]),
  confidence: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  evidence: z.array(z.string()),
  fixes: z.array(z.string()),
  testerNextStep: z.string(),
});

export type WatchDiagnosis = z.infer<typeof Diagnosis>;

const SYSTEM = `You diagnose why a web page fails to stay painted on cheap Android smartwatch panels
(Lokmat-class 640x320 and round 454x454 devices, Android 7-10, old Chrome/WebView).

Decide between these causes:
- sizing: the page renders but is measured to zero/odd height or pinned to a corner (viewport units,
  screen vs window mismatch, missing measured height, unusual device pixel ratio).
- rendering: compositing or texture failure (large images, canvas/WebGL, backdrop-filter, heavy
  gradients, GPU memory exhaustion) that leaves the panel black after a first paint.
- display-sleep: the watch's own screen timeout or ambient mode, no wake lock held, panel blanks a
  few seconds after paint regardless of page content.
- script-crash: JavaScript fails on the old engine and the hydrated markup is torn down, so a page
  that painted from the server goes blank.
- network: assets or data never arrive, so nothing after the shell renders.

Use the reported reference pages: if some pages on the same device paint and stay, the cause is
specific to the failing page, not the device. Weigh device metrics heavily: a wake-lock-less device
that blanks after a few seconds is display-sleep; a page whose measured app height is 0 is sizing.

Write for a non-programmer tester. Every fix is one plain sentence naming what to change.
Keep summary under 40 words, at most 4 evidence lines, at most 4 fixes.`;

export const diagnoseWatchReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReportInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.recordingPath && !data.recordingPath.startsWith(`${context.userId}/`)) {
      throw new Error("That recording does not belong to this account.");
    }
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("The diagnosis service is not configured yet.");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const brief = [
      `Symptom: ${data.symptom}`,
      `Watch model: ${data.watchModel ?? "not given"}`,
      `Android / OS: ${data.osVersion ?? "not given"}`,
      `Browser or shell: ${data.browser ?? "not given"}`,
      `Pages that paint and stay on this same watch: ${data.pagesThatWork ?? "not given"}`,
      `Tester notes: ${data.notes ?? "none"}`,
      `Measured device profile: ${JSON.stringify(data.profile)}`,
    ].join("\n");

    let diagnosis: WatchDiagnosis;
    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "text" as const, text: brief },
              ...data.frames.map((f) => ({ type: "image" as const, image: f })),
            ],
          },
        ],
        output: Output.object({ schema: Diagnosis }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "medium",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      diagnosis = (await result.output) as WatchDiagnosis;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("The report came back unreadable. Try sending it again.");
      }
      throw error;
    }

    // Record the report for the build log. A failure here must not lose the
    // tester's diagnosis, so it is best effort.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("watch_reports").insert({
        user_id: context.userId,
        watch_model: data.watchModel,
        os_version: data.osVersion,
        browser: data.browser,
        symptom: data.symptom,
        notes: [data.notes, data.pagesThatWork ? `Works: ${data.pagesThatWork}` : null]
          .filter(Boolean)
          .join("\n"),
        recording_path: data.recordingPath,
        device_profile: JSON.parse(JSON.stringify(data.profile)),
        diagnosis: JSON.parse(JSON.stringify(diagnosis)),
      });
    } catch {
      /* the tester still gets their answer */
    }

    return diagnosis;
  });
