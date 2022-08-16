"use strict";

const should = require("should");
const {
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
} = require("../../../lib/kerror/errors");

describe("Errors", () => {
  it("should constructs TooManyRequestsError", () => {
    const error = new TooManyRequestsError("message", "id.error", 4242);

    should(error.message).be.eql("message");
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(429);
  });

  it("should constructs PreconditionError", () => {
    const error = new PreconditionError("message", "id.error", 4242);

    should(error.message).be.eql("message");
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(412);
  });

  it("should constructs UnauthorizedError", () => {
    const error = new UnauthorizedError("message", "id.error", 4242);

    should(error.message).be.eql("message");
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(401);
  });

  it("should constructs SizeLimitError", () => {
    const error = new SizeLimitError("message", "id.error", 4242);

    should(error.message).be.eql("message");
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(413);
  });

  it("should constructs ServiceUnavailableError", () => {
    const error = new ServiceUnavailableError("message", "id.error", 4242);

    should(error.message).be.eql("message");
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(503);
  });

  it("should constructs PluginImplementationError", () => {
    const error = new PluginImplementationError("message", "id.error", 4242);

    should(error.message).be.eql(
      "message\nThis is probably not a Kuzzle error, but a problem with a plugin implementation."
    );
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(500);
  });

  it("should constructs NotFoundError", () => {
    const error = new NotFoundError("message", "id.error", 4242);

    should(error.message).be.eql("message");
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(404);
  });

  it("should constructs InternalError", () => {
    const error = new InternalError("message", "id.error", 4242);

    should(error.message).be.eql("message");
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(500);
  });

  it("should constructs BadRequestError", () => {
    const error = new BadRequestError("message", "id.error", 4242);

    should(error.message).be.eql("message");
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(400);
  });

  it("should constructs ForbiddenError", () => {
    const error = new ForbiddenError("message", "id.error", 4242);

    should(error.message).be.eql("message");
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(403);
  });

  it("should constructs GatewayTimeoutError", () => {
    const error = new GatewayTimeoutError("message", "id.error", 4242);

    should(error.message).be.eql("message");
    should(error.id).be.eql("id.error");
    should(error.code).be.eql(4242);
    should(error.status).be.eql(504);
  });
});
