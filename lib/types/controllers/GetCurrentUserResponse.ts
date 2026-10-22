import type { User } from "../../model/security/user";
import type { Serialized } from "../core/auth/Serialized";

export type GetCurrentUserResponse = Serialized<User> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  strategies: any;
};
