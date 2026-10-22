import type { User } from "../../model/security/user";
import type { Serialized } from "../core/auth/Serialized";

export type GetCurrentUserResponse = Serialized<User> & {
  strategies: any;
};
