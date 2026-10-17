// Community build: watch report diagnosis is not available.
// Reports are collected locally; diagnosis runs in the private estate only.
import { createServerFn } from "@tanstack/react-start";

type WatchReportInput = {
  watchModel: string | null;
  osVersion: string | null;
  browser: string | null;
  symptom: string;
  pagesThatWork: string | null;
  notes: string | null;
  recordingPath: string | null;
  frames: string[];
  profile: Record<string, unknown>;
};
export type WatchDiagnosis = {
  primaryCause:
    | "sizing"
    | "rendering"
    | "display-sleep"
    | "script-crash"
    | "network"
    | "unclear";
  confidence: "low" | "medium" | "high";
  summary: string;
  evidence: string[];
  fixes: string[];
  testerNextStep: string;
};

export const diagnoseWatchReport = createServerFn({ method: "POST" })
  .inputValidator((input: WatchReportInput): WatchReportInput => input)
  .handler(async (): Promise<WatchDiagnosis> => {
    throw new Error("Watch report diagnosis is unavailable in the community build.");
  });
