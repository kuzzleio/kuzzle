import { describe, expect, it } from "vitest";

import { invalid } from "../helpers/invalid";

import * as kerror from "../../lib/kerror";
import { InternalError } from "../../lib/kerror/errors/internalError";
import { ExternalServiceError } from "../../lib/kerror/errors/externalServiceError";
import { NotFoundError } from "../../lib/kerror/errors/notFoundError";
import { PreconditionError } from "../../lib/kerror/errors/preconditionError";
import { PartialError } from "../../lib/kerror/errors/partialError";
import { UnauthorizedError } from "../../lib/kerror/errors/unauthorizedError";
import { KuzzleError } from "../../lib/kerror/errors/kuzzleError";

describe("#kerror", () => {
  it("allows custom KuzzleError", () => {
    const domains = {
      custom: {
        code: 1,
        subDomains: {
          httpStatus: {
            code: 1,
            errors: {
              conflict: {
                status: 409,
                message: "add 9 for the teapot %s",
                code: 1,
                class: "KuzzleError",
              },
            },
          },
        },
      },
    };

    const err = kerror.rawGet(
      invalid(domains),
      "custom",
      "httpStatus",
      "conflict",
      "placeHolder-1",
    );

    expect(err).toBeInstanceOf(KuzzleError);
    expect(err.status).toEqual(409);
    expect(err.props).toEqual(["placeHolder-1"]);
  });

  it("returns an ExternalServiceError with right name, msg and code", () => {
    const err = kerror.get(
      "core",
      "fatal",
      "service_unavailable",
      '{"status":"red"}',
    );
    expect(err).toBeInstanceOf(ExternalServiceError);
    expect(err).toMatchObject({
      id: "core.fatal.service_unavailable",
      code: parseInt("00000002", 16),
      message: 'Service unavailable: {"status":"red"}.',
    });
  });

  it("overrides original message", () => {
    const err = kerror.get(
      "core",
      "fatal",
      "service_unavailable",
      "Lambda Core",
      { message: "Anomalous Materials" },
    );

    expect(err).toBeInstanceOf(ExternalServiceError);
    expect(err).toMatchObject({
      id: "core.fatal.service_unavailable",
      code: parseInt("00000002", 16),
      message: "Anomalous Materials",
    });
  });

  it("returns an InternalError with default name, msg and code", () => {
    const err = kerror.get("api", "assert", "fake_error", '{"status":"error"}');
    expect(err).toBeInstanceOf(InternalError);
    expect(err).toMatchObject({
      id: "core.fatal.unexpected_error",
      code: parseInt("00000001", 16),
      message: "Caught an unexpected error: api.assert.fake_error.",
    });
  });

  it("returns a NotFoundError with default name, msg and code", () => {
    const err = kerror.get(
      "services",
      "storage",
      "not_found",
      "fake_id",
      "index",
      "collection",
    );
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err).toMatchObject({
      id: "services.storage.not_found",
      code: parseInt("0101000b", 16),
      message: 'Document "fake_id" not found in "index":"collection".',
    });
  });

  it("returns a PreconditionError with default name, msg and code", () => {
    const err = kerror.get("services", "storage", "unknown_index", "foo");
    expect(err).toBeInstanceOf(PreconditionError);
    expect(err).toMatchObject({
      id: "services.storage.unknown_index",
      code: parseInt("01010001", 16),
      message: 'The index "foo" does not exist.',
    });
  });

  it("returns an UnauthorizedError with default name, msg and code", () => {
    const err = kerror.get("security", "token", "invalid");
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err).toMatchObject({
      id: "security.token.invalid",
      code: parseInt("07010001", 16),
      message: "Invalid token.",
    });
  });

  it("returns a PartialError with default name, msg and code", () => {
    const err = kerror.get("services", "storage", "import_failed", [
      "foo",
      "bar",
    ]);

    expect(err).toBeInstanceOf(PartialError);
    expect(err).toMatchObject({
      id: "services.storage.import_failed",
      errors: ["foo", "bar"],
      count: 2,
      code: parseInt("01010005", 16),
      message: "Failed to import some or all documents.",
    });
  });
});
