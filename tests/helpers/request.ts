import type { JSONObject } from "kuzzle-sdk";

import type { KuzzleRequest } from "../../lib/api/request";
import type { User } from "../../lib/model/security/user";
import { present } from "./present";

/**
 * The user a spec has just put on a request's context — `context.user` is
 * nullable because a request starts without one.
 */
/**
 * The body a spec has just given a request.
 *
 * `input.body` is `JSONObject | null` and that is right — a request can carry
 * none — but a test that built one with a body is in the other case. Saying so
 * here keeps the dozen dereferences in a controller spec readable, and fails on
 * the line that assumed a body rather than on the property read after it.
 */
export function userOf(request: KuzzleRequest): User {
  present(request.context.user, "request.context.user");

  return request.context.user;
}

export function bodyOf(request: KuzzleRequest): JSONObject {
  present(request.input.body, "request.input.body");

  return request.input.body;
}
