/**
 * An application reading and writing its configuration.
 */

import type {
  IKuzzleConfiguration,
  JSONObject,
  KuzzleConfiguration,
  PluginsConfiguration,
  SecurityConfiguration,
} from "kuzzle";
import { Backend } from "kuzzle";

const app = new Backend("typings");

// Reads: the loaded configuration is whole.
app.config.content.limits.documentsWriteCount = 1000;
app.config.content.plugins.common.pipeWarnTime = 1000;
export const storageClient = app.config.content.services.storageEngine.client;
export const jwt = app.config.content.security.jwt;

// TY-07: an HTTP origin read as v2.56.0 declared it.
export const origin: string = app.config.content.http.accessControlAllowOrigin;

// TY-07: any plugin's entry is a `JSONObject`.
const plugins: PluginsConfiguration = app.config.content.plugins;
export const pluginEntry: JSONObject = plugins["my-plugin"];
export const pluginOption: string = app.config.content.plugins["my-plugin"].opt;
export const logger = plugins["kuzzle-plugin-logger"];

export const security: SecurityConfiguration = app.config.content.security;

// TY-07: a configuration that omits whole sections, read back.
const partial: KuzzleConfiguration = {
  limits: app.config.content.limits,
};
export const fetchCount: number = partial.limits!.documentsFetchCount;

// Writes: a whole section, a partial one, the lot.
app.config.merge({ limits: { documentsFetchCount: 100 } });
app.config.merge({ server: { port: 7512 } });
app.config.content = { ...app.config.content };

// TY-07: the content assigned from a `Partial`, as v2.56.0 declared it.
export function reset(content: Partial<IKuzzleConfiguration>) {
  app.config.content = content;
}

// TY-07: startup validation specifications, as v2.56.0 declared them.
export const validation: IKuzzleConfiguration["validation"] = {
  idx: { col: { fields: { a: { type: "string" } } } },
};
export const looseValidation: IKuzzleConfiguration["validation"] = {
  foo: 42,
} as Record<string, unknown>;

export const whole: IKuzzleConfiguration = app.config.content;
