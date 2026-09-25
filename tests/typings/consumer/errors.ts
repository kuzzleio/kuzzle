/**
 * Errors, as applications and plugins throw, extend and read them.
 */

import type { JSONObject } from "kuzzle";
import {
  Backend,
  BadRequestError,
  ForbiddenError,
  InternalError,
  KuzzleError,
  NotFoundError,
  PartialError,
  PreconditionError,
} from "kuzzle";

const app = new Backend("typings");

app.errors.register("app", "api", "custom", {
  class: "BadRequestError",
  description: "This is a custom error from API subdomain",
  message: "Custom %s error",
});

// TY-05: the fields read as v2.56.0 declared them.
export function read() {
  const error: KuzzleError = app.errors.get("app", "api", "custom", "x");
  const fromError = app.errors.getFrom(new Error("x"), "app", "api", "custom");
  const wrapped = app.errors.wrap("app", "api").get("custom", "foo");

  const code: number = error.code;
  const id: string = error.id;
  const props: string[] = error.props;
  const joined: string = error.props.join(",");
  const status: number = error.status;

  return { code, fromError, id, joined, props, status, wrapped };
}

// TY-05: the constructors take what v2.56.0's untyped ones took.
export function build(input: number, caught: unknown, errors: Error[]) {
  switch (input) {
    case 0:
      return new BadRequestError("Missing input");
    case 1:
      return new NotFoundError(`Not found ${input}`, "api.assert.x", 42);
    case 2:
      // A `catch` variable is `unknown` under `strict`.
      return new InternalError(caught);
    case 3:
      return new InternalError(input);
    case 4:
      return new PreconditionError({ reason: "bad" });
    case 5:
      return new PartialError("partial", [{ _id: "a", reason: "x" }], "id", 1);
    case 6:
      return new PartialError("partial", errors);
    case 7:
      return new PartialError("partial", [new BadRequestError("x")]);
    default:
      return new KuzzleError("generic", 400);
  }
}

export function rethrow(caught: { message: string; id: string; code: number }) {
  return new ForbiddenError(caught.message, caught.id, caught.code);
}

export class TeapotError extends KuzzleError {
  constructor(
    message: string,
    public details: JSONObject,
  ) {
    super(message, 418, "app.custom.teapot", 42);
  }
}

export class MissingThingError extends BadRequestError {
  constructor(message: string) {
    super(message, "app.custom.missing", 1);
  }
}

export const teapotCode: number = new TeapotError("x", {}).code;
