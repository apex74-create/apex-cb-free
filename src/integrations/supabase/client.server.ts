// Community build stub. There is no service-role client in the public
// mirror: server handlers here run with the publishable key and RLS only.
// Privileged operations fail closed instead of bypassing row security.

type Never = never;

export const supabaseAdmin: Never = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "Privileged database access is unavailable in the community build.",
      );
    },
  },
) as Never;
