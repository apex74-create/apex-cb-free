// Community build: licence verification against the private estate is not
// available. Locally owned behaviour must not depend on this call.
import { createServerFn } from "@tanstack/react-start";

type Proof = { pub: string; sigHash: string; ts: number; sig: string };
type VerifiedLicencesResult = {
  slugs: string[];
  status: "ok" | "limit" | "unverified";
};

export const verifiedLicences = createServerFn({ method: "POST" })
  .inputValidator((data: Proof): Proof => data)
  .handler(async (): Promise<VerifiedLicencesResult> => ({
    slugs: [],
    status: "unverified",
  }));
