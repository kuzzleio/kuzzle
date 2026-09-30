/**
 * Less travelled corners of the API, written the way v2.56.0's declarations
 * let code be written: complete configuration objects, untyped arguments,
 * results read or assigned without narrowing.
 */

import type {
  IKuzzleConfiguration,
  JSONObject,
  KuzzleRequest,
  PluginHookDefinition,
  PluginPipeDefinition,
  SecurityConfiguration,
} from "kuzzle";
import {
  Backend,
  Inflector,
  ObjectRepository,
  QueryTranslator,
  RequestInput,
  RequestResponse,
  cacheDbEnum,
} from "kuzzle";
// A deep import: `Profile` is the SDK's at the package root.
import { Profile } from "kuzzle/dist/lib/model/security/profile";

const app = new Backend("typings");

// T-12: configuration objects built without the members v2.56.0 lacked.
export function complete(
  content: Omit<IKuzzleConfiguration, "version" | "vault">,
): IKuzzleConfiguration {
  return content;
}
export const internal: IKuzzleConfiguration["internal"] = {
  hash: null,
  notifiableProtocols: [],
};
export const cluster: IKuzzleConfiguration["cluster"] = {
  activityDepth: 50,
  enabled: true,
  heartbeat: 2000,
  interface: null,
  ip: "private",
  ipv6: false,
  joinTimeout: 60000,
  minimumNodes: 1,
  ports: { command: 7511, sync: 7510 },
  syncTimeout: 5000,
};

// T-14: a security section without the deprecated `jwt`.
export function security(
  section: Omit<SecurityConfiguration, "jwt">,
): SecurityConfiguration {
  return section;
}

// T-16 and T-17: untyped constructor arguments, header setters' answers.
export function response(raw: unknown, request: KuzzleRequest): void {
  const built = new RequestResponse(raw);
  const set: string = request.response.setHeader("x-a", "b");

  app.log.debug(`${built.status} ${set}`);

  return request.response.removeHeader("x-a");
}
export const input = (raw: unknown) => new RequestInput(raw);

// T-22: a wrapped error manager, handed an untyped name.
const wrapped = app.errors.wrap("app", "api");
export const wrappedErrors = (name: unknown, caught: unknown) => [
  wrapped.get(name),
  wrapped.getFrom(caught, name),
];
export const rejected: Promise<string> = wrapped.reject("custom");

// T-24: reading a hook or pipe definition back, and calling it.
export async function replay(
  hooks: PluginHookDefinition,
  pipes: PluginPipeDefinition,
  request: KuzzleRequest,
) {
  const hook = hooks["document:afterCreate"];
  if (hook !== undefined && !Array.isArray(hook)) {
    await hook(request);
  }

  const pipe = pipes["document:beforeCreate"];
  if (pipe !== undefined && !Array.isArray(pipe)) {
    return pipe(request);
  }

  return request;
}

// T-26: a repository with a store of its own, read without narrowing.
type Driver = { _id: string; name: string };

export class LegacyDriverRepository extends ObjectRepository<Driver> {
  constructor(store: unknown) {
    super({ cache: cacheDbEnum.NONE, store });
    this.collection = "drivers";
  }

  async report() {
    const found = await this.search({ query: {} }, { size: 10 });
    const byName: JSONObject = found.aggregations.byName;
    const names: Array<{ name: string }> = found.hits;
    const scrollId: string = found.scrollId;
    const next = await this.scroll(scrollId, "1m");
    const deleted: { count: number } = await this.truncate(undefined);

    return { byName, deleted, names, next: next.total };
  }

  serializeToDatabase(driver: Driver): Omit<Driver, "_id"> {
    return { name: driver.name };
  }

  stored(driver: Driver): Omit<Driver, "_id"> {
    return super.serializeToDatabase(driver);
  }
}

// T-31 and T-32: untyped arguments, answers assigned to one's own types.
export const query: { bool: JSONObject } = new QueryTranslator().translate(
  JSON.parse("{}") as unknown,
);
export const camel: string = Inflector.camelCase(42 as unknown);

// Profile._hash, v2.56.0's `() => boolean`.
export const unpatched: boolean = Profile._hash();
