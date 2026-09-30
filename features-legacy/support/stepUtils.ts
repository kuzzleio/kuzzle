import type { JSONObject } from "kuzzle-sdk";

import ApiBase from "./api/apiBase";
import HttpApi from "./api/http";
import type KWorld from "./world";

/**
 * The callback cucumber hands a step definition that signals completion by
 * calling back instead of by returning a promise. Cucumber types it as a plain
 * `Function`, so a step that does not name it gets an implicit `any`.
 */
export type StepCallback = (error?: Error | null) => void;

/**
 * What a task retried through `async` in this suite actually hands its
 * callback: a message the task wrote itself, the `Error` a protocol wrapper
 * rejected with, or the API error payload behind it. Named because
 * `async.retry`'s own error parameter defaults to `Error`, and the default is
 * not what these tasks do.
 */
export type RetryFailure = string | Error | JSONObject;

/**
 * How a task retried through `async` reports back.
 */
export type AsyncCallback = (failure?: RetryFailure | null) => void;

/**
 * A retried task's failure, as the `Error` cucumber expects.
 *
 * Every retry callback used to do this inline, in four spellings, and all four
 * rebuilt an `Error` around the message of the one they had been handed —
 * losing its stack and its `statusCode`. Passing the original through is the
 * same report with more of it left.
 */
export function asError(failure: RetryFailure): Error {
  if (failure instanceof Error) {
    return failure;
  }

  if (typeof failure === "string") {
    return new Error(failure);
  }

  return new Error(
    typeof failure.message === "string"
      ? failure.message
      : JSON.stringify(failure),
  );
}

/**
 * The HTTP status carried by whatever a wrapper rejected with, when it carries
 * one. `strict` types a `catch` binding as `unknown`, which is right: a step
 * that branches on `error.statusCode` is making a claim about the shape of
 * something it did not construct, and the claim has to be checked.
 */
export function apiErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const { statusCode } = error as { statusCode?: unknown };

    return typeof statusCode === "number" ? statusCode : undefined;
  }

  return undefined;
}

/**
 * The HTTP wrapper, for a step or hook that only runs under `@http`. The world
 * holds whichever protocol the run was started with, so a step reaching an
 * HTTP-only method has to say so and fail by name, rather than assume.
 */
export function httpApi(world: KWorld): HttpApi {
  if (!(world.api instanceof HttpApi)) {
    throw new Error(
      `This step is @http-only, but the run's protocol is "${world.config.protocol}"`,
    );
  }

  return world.api;
}

/**
 * The realtime wrapper, for a step or hook that only runs under `@realtime`.
 * `ApiBase` is the realtime base — `HttpApi` deliberately does not extend it —
 * so it is what "this protocol can subscribe" means here.
 */
export function realtimeApi(world: KWorld): ApiBase {
  if (!(world.api instanceof ApiBase)) {
    throw new Error(
      `This step is @realtime-only, but the run's protocol is "${world.config.protocol}"`,
    );
  }

  return world.api;
}

/**
 * The name of an API wrapper method, whichever protocol the world is running.
 * `getReturn` dispatches on a name computed at its call site, so the name is
 * what has to be constrained — a typo in it is otherwise a runtime `undefined
 * is not a function`.
 */
type ApiMethodName = {
  [K in keyof KWorld["api"]]: KWorld["api"][K] extends (
    ...args: any[]
  ) => Promise<any>
    ? K
    : never;
}[keyof KWorld["api"]];

function getReturn(
  this: KWorld,
  action: ApiMethodName,
  ...args: [...any[], StepCallback]
): void {
  const callback = args.pop() as StepCallback;
  // The mapped type above has already established that this is a method
  // returning a promise; the assertion only makes it callable with a spread,
  // which a union of signatures is not.
  const method = this.api[action] as (...a: any[]) => Promise<any>;

  method
    .apply(this.api, args)
    .then((response) => {
      this.result = response;
      callback();
    })
    .catch((error) => {
      this.result = error;
      callback();
    });
}

export default {
  getReturn,
};
