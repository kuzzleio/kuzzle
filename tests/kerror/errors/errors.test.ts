import { describe, expect, it } from "vitest";

import {
  BadRequestError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalError,
  NotFoundError,
  PluginImplementationError,
  ServiceUnavailableError,
  SizeLimitError,
  UnauthorizedError,
  PreconditionError,
  TooManyRequestsError,
} from "../../../lib/kerror/errors";

describe("Errors", () => {
  it("constructs TooManyRequestsError", () => {
    const error = new TooManyRequestsError("message", "id.error", 4242);

    expect(error.message).toEqual("message");
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(429);
  });

  it("constructs PreconditionError", () => {
    const error = new PreconditionError("message", "id.error", 4242);

    expect(error.message).toEqual("message");
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(412);
  });

  it("constructs UnauthorizedError", () => {
    const error = new UnauthorizedError("message", "id.error", 4242);

    expect(error.message).toEqual("message");
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(401);
  });

  it("constructs SizeLimitError", () => {
    const error = new SizeLimitError("message", "id.error", 4242);

    expect(error.message).toEqual("message");
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(413);
  });

  it("constructs ServiceUnavailableError", () => {
    const error = new ServiceUnavailableError("message", "id.error", 4242);

    expect(error.message).toEqual("message");
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(503);
  });

  it("constructs PluginImplementationError", () => {
    const error = new PluginImplementationError("message", "id.error", 4242);

    expect(error.message).toEqual(
      "message\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.",
    );
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(500);
  });

  it("constructs NotFoundError", () => {
    const error = new NotFoundError("message", "id.error", 4242);

    expect(error.message).toEqual("message");
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(404);
  });

  it("constructs InternalError", () => {
    const error = new InternalError("message", "id.error", 4242);

    expect(error.message).toEqual("message");
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(500);
  });

  it("constructs BadRequestError", () => {
    const error = new BadRequestError("message", "id.error", 4242);

    expect(error.message).toEqual("message");
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(400);
  });

  it("constructs ForbiddenError", () => {
    const error = new ForbiddenError("message", "id.error", 4242);

    expect(error.message).toEqual("message");
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(403);
  });

  it("constructs GatewayTimeoutError", () => {
    const error = new GatewayTimeoutError("message", "id.error", 4242);

    expect(error.message).toEqual("message");
    expect(error.id).toEqual("id.error");
    expect(error.code).toEqual(4242);
    expect(error.status).toEqual(504);
  });
});
