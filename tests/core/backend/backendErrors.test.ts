import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Backend } from "../../../lib/core/backend/backend";
import { createBackend, internals } from "./backendFixture";

vi.mock("../../../lib/kuzzle", async () => {
  const { FakeKuzzle } = await import("./fakeKuzzle");

  return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
});

describe("BackendErrors", () => {
  let app: Backend;

  beforeEach(async () => {
    app = await createBackend();
  });

  describe("#register", () => {
    it("registers a standard error, numbering domains, subdomains and errors", () => {
      app.errors.register("app", "api", "wtf", {
        description: "WTF",
        message: "WTF bruh",
        class: "BadRequestError",
      });
      app.errors.register("app", "api", "stfu", {
        description: "STFU",
        message: "STFU bro",
        class: "BadRequestError",
      });

      expect(internals(app.errors).domains).toEqual({
        app: {
          code: 0,
          subDomains: {
            api: {
              code: 0,
              errors: {
                wtf: {
                  code: 0,
                  description: "WTF",
                  message: "WTF bruh",
                  class: "BadRequestError",
                },
                stfu: {
                  code: 1,
                  description: "STFU",
                  message: "STFU bro",
                  class: "BadRequestError",
                },
              },
            },
          },
        },
      });
    });
  });

  describe("#get", () => {
    it("gets a standard error, with its placeholders applied", async () => {
      app.errors.register("iot", "api", "wtf", {
        description: "WTF",
        message: "WTF bruh %s",
        class: "BadRequestError",
      });

      const error = app.errors.get("iot", "api", "wtf", "custom");

      // Imported here rather than at the top of the file: `createBackend`
      // re-evaluates the module graph, so the class the subject instantiated
      // is the one on the *current* graph, not the one a static import bound.
      const { BadRequestError } = await import("../../../index");

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe("WTF bruh custom");
      expect(error.id).toBe("iot.api.wtf");
    });
  });
});
