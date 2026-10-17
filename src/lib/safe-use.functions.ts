// Community build: safe-use acceptance is tracked in the private estate.
// The policy version is public so the UI can display it; acceptance is local-only.
import { createServerFn } from "@tanstack/react-start";

export const SAFE_USE_POLICY_VERSION = "2026-09-30";
export const SAFE_USE_PACK = "radiolab";

type SafeUseStatus = {
  accepted: boolean;
  acceptedAt: string | null;
  policyVersion: string;
};
type AcceptSafeUseInput = { confirm: true };
type AcceptSafeUseResult = { accepted: boolean; policyVersion: string };

export const getSafeUseStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<SafeUseStatus> => ({
    accepted: false,
    acceptedAt: null,
    policyVersion: SAFE_USE_POLICY_VERSION,
  }),
);

export const acceptSafeUse = createServerFn({ method: "POST" })
  .inputValidator((input: AcceptSafeUseInput): AcceptSafeUseInput => input)
  .handler(async (): Promise<AcceptSafeUseResult> => {
    throw new Error("Safe-use acceptance is unavailable in the community build.");
  });
