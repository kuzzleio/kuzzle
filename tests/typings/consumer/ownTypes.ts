/**
 * The types Kuzzle owns (ADR-0002 step 02): its `JSONObject`, which must stay
 * interchangeable with the SDK's, and the server models behind
 * `request.context`, under their own names.
 */

import type {
  ImportConfig,
  InstallationConfig,
  JSONObject,
  KuzzleRequest,
  KuzzleToken,
  KuzzleUser,
  Plugin,
  StartOptions,
  SupportConfig,
  Token,
} from "kuzzle";
import type { JSONObject as SdkJSONObject } from "kuzzle-sdk";

// A plugin mixing both imports: each `JSONObject` assigns to the other.
declare const fromKuzzle: JSONObject;
declare const fromSdk: SdkJSONObject;
export const kuzzleToSdk: SdkJSONObject = fromKuzzle;
export const sdkToKuzzle: JSONObject = fromSdk;
export const kuzzleToSdkList: SdkJSONObject[] = [fromKuzzle];
export const sdkToKuzzleList: JSONObject[] = [fromSdk];

// The server-side user and token a request carries, named.
export function whoami(request: KuzzleRequest) {
  const u: KuzzleUser = request.context.user!;
  const t: KuzzleToken = request.context.token!;
  const userId: string = u._id;
  const profileIds: string[] = u.profileIds;
  const type: "apiKey" | "authToken" = t.type;

  return { profileIds, type, userId };
}

// TD-07: the server token has every member of the `Token` interface, at the
// same type, except `connectionId` — which no runtime token carries, so it is
// not declared on `KuzzleToken` and `Token` is not assignable from it.
export function tokenAsInterface(request: KuzzleRequest) {
  const t: KuzzleToken = request.context.token!;
  const members: Pick<
    Token,
    "_id" | "expiresAt" | "jwt" | "refreshed" | "ttl" | "type" | "userId"
  > = t;

  return members;
}

// `Token.connectionId` is deprecated (never set), not removed: code that reads
// it from the interface keeps compiling, at the type it always had.
export function deprecatedConnectionId(token: Token): string | null {
  return token.connectionId;
}

// TD-05: the shapes `Plugin.imports` and the server's start options are typed
// with, importable by name.
export const pluginImports: ImportConfig = {
  mappings: { nyc: { collections: {} } },
  onExistingUsers: "skip",
};

export function importsOf(plugin: Plugin): ImportConfig | undefined {
  return plugin.imports;
}

export const fixtures: SupportConfig = {
  fixtures: {},
  securities: { profiles: {}, roles: {}, users: {} },
};

export const installation: InstallationConfig = {
  description: "seed the catalog",
  handler: async () => {},
  id: "seed-catalog",
};

export const startOptions: StartOptions = {
  import: pluginImports,
  installations: [installation],
  support: fixtures,
};
