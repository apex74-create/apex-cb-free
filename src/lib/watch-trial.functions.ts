// Community build: watch trials are not issued here.
// The full implementation lives in the private Apex estate.
import { createServerFn } from "@tanstack/react-start";

type WatchTrialResult = {
  state: "trial" | "owned" | "inactive";
  expiresAt: string | null;
};

export const startWatchTrial = createServerFn({ method: "POST" }).handler(
  async (): Promise<WatchTrialResult> => {
    throw new Error("Watch trial issuance is unavailable in the community build.");
  },
);
