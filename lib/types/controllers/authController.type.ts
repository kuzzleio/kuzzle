import type { User } from "../../model/security/user";
import type { Serialized } from "../core/auth/formatProcessing.type";

export type GetCurrentUserResponse = Serialized<User> & {
  strategies: any;
};
