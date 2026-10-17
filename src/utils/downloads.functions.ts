// Community build: licence-gated download grants are not available.
// The full implementation lives in the private Apex estate.
import { createServerFn } from "@tanstack/react-start";

export type DownloadGrant = {
  branchId: string;
  ref: string;
  licenceKey: string;
  viaSlug: string;
};
export type DownloadGrantResult = {
  slugs: string[];
  grants: DownloadGrant[];
};

export const getDownloadGrants = createServerFn({ method: "GET" })
  .handler(async (): Promise<DownloadGrantResult> => ({
    slugs: [],
    grants: [],
  }));
