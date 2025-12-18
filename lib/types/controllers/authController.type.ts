import { User } from "../../model/security/user";
import { Serialized } from "../core/auth/formatProcessing.type";

export type GetCurrentUserResponse = Serialized<User> & {
  strategies: any;
};
