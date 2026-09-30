import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NativeController } from "../../../lib/api/controllers/baseController";
import { KuzzleRequest } from "../../../lib/api/request";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#api/controllers/NativeController", () => {
  let controller: NativeController;
  let ask: ReturnType<typeof vi.fn>;
  let listStrategies: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ask = vi.fn(async () => undefined);
    listStrategies = vi.fn(() => []);

    stubKuzzle({
      ask,
      config: { limits: { documentsFetchCount: 10 } },
      pipe: async () => undefined,
      pluginsManager: { listStrategies },
    });

    controller = new NativeController(["speak", "fight"]);
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("should initialize its actions list from the constructor", () => {
    Object.assign(controller, { privateAction: () => {} });

    expect(controller._isAction("speak")).toBe(true);
    expect(controller._isAction("fight")).toBe(true);
    expect(controller._isAction("privateAction")).toBe(false);
  });

  describe("#translateKoncorde", () => {
    const koncordeFilters = { equals: { name: "Melis" } };

    it("should translate the filter before passing it to the storage engine", async () => {
      ask.mockResolvedValue({ term: { name: "Melis" } });

      await expect(
        controller.translateKoncorde(koncordeFilters),
      ).resolves.toEqual({ term: { name: "Melis" } });

      expect(ask).toHaveBeenCalledWith("core:storage:public:translate", {
        equals: { name: "Melis" },
      });
    });

    it("should reject if the query is not an object", async () => {
      const rejection = controller.translateKoncorde(
        invalid<Record<string, unknown>>("not an object"),
      );

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.invalid_type",
      });
    });

    it("should reject when the translation fails", async () => {
      ask.mockRejectedValue(
        Object.assign(new Error("message"), {
          keyword: { type: "operator", name: "n0t" },
        }),
      );

      const rejection = controller.translateKoncorde(koncordeFilters);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.koncorde_restricted_keyword",
      });
    });

    it("should return an empty object if the filters are empty", async () => {
      await expect(controller.translateKoncorde({})).resolves.toEqual({});

      expect(ask).not.toHaveBeenCalled();
    });
  });

  describe("#assertTargetsAreValid", () => {
    /*
     * ⚠️ Every one of these was asserting nothing in the Mocha spec. The
     * method is synchronous, and the spec wrapped it in an async IIFE whose
     * `should(...).rejectedWith(...)` was neither returned nor awaited:
     *
     *   should((async () => { ctrl.assertTargetsAreValid(…); })())
     *     .rejectedWith(BadRequestError, { id: … });
     *
     * The `it` returned `undefined`, so the test passed before the assertion
     * ever ran — including the two "should not reject" ones, which would have
     * passed just as well had the method thrown. And it does: they passed the
     * option as `emptyCollectionsAllowed`, while the method reads
     * `allowEmptyCollections`. Two dead tests, wrong twice over.
     */
    const assert =
      (targets: unknown[], options?: { allowEmptyCollections: boolean }) =>
      () =>
        controller.assertTargetsAreValid(
          invalid<Parameters<NativeController["assertTargetsAreValid"]>[0]>(
            targets,
          ),
          options,
        );

    it("should throw if a target index is missing", () => {
      expect(assert([{ collections: "foo" }])).toThrow(
        expect.objectContaining({ id: "api.assert.missing_argument" }),
      );
    });

    it("should throw if target collections are missing", () => {
      expect(assert([{ index: "index" }])).toThrow(
        expect.objectContaining({ id: "api.assert.missing_argument" }),
      );
    });

    it("should throw if target collections are empty", () => {
      expect(assert([{ index: "index", collections: [] }])).toThrow(
        expect.objectContaining({ id: "api.assert.empty_argument" }),
      );
    });

    it("should accept empty collections when they are allowed", () => {
      expect(
        assert([{ index: "index", collections: [] }], {
          allowEmptyCollections: true,
        }),
      ).not.toThrow();
    });

    it("should accept missing collections when empty ones are allowed", () => {
      expect(
        assert([{ index: "index" }], { allowEmptyCollections: true }),
      ).not.toThrow();
    });

    it("should throw if the collections field is not an array", () => {
      expect(assert([{ index: "index", collections: "" }])).toThrow(
        expect.objectContaining({ id: "api.assert.invalid_type" }),
      );
    });

    it("should throw if one of the collections is not a string", () => {
      expect(assert([{ index: "index", collections: [42] }])).toThrow(
        expect.objectContaining({ id: "api.assert.invalid_type" }),
      );
    });

    it("should throw if a collection carries a multi-target character", () => {
      expect(assert([{ index: "index", collections: ["a,b"] }])).toThrow(
        expect.objectContaining({
          id: "services.storage.invalid_target_format",
        }),
      );
    });

    it("should throw if the index carries a multi-target character", () => {
      expect(assert([{ index: "index,bar", collections: ["foo"] }])).toThrow(
        expect.objectContaining({
          id: "services.storage.invalid_target_format",
        }),
      );
    });
  });

  describe("#assertBodyHasNotAttributes", () => {
    it("should throw when the body carries a forbidden attribute", () => {
      const request = new KuzzleRequest({ body: { invalid: "42" } });

      /*
       * `...paths: string[]`, and the Mocha spec passed `["invalid"]` — an
       * array where a path goes. It happened to work because lodash reads an
       * array as a deep path; it is a TS2345 here.
       */
      expect(() =>
        controller.assertBodyHasNotAttributes(request, "invalid"),
      ).toThrow(
        expect.objectContaining({ id: "api.assert.forbidden_argument" }),
      );
    });

    it("should accept a body that carries none of them", () => {
      const request = new KuzzleRequest({ body: { valid: "42" } });

      expect(() =>
        controller.assertBodyHasNotAttributes(request, "invalid"),
      ).not.toThrow();
    });
  });

  describe("#assertIsStrategyRegistered", () => {
    it("should throw for an unknown strategy", () => {
      listStrategies.mockReturnValue(["local", "oauth"]);

      expect(() => controller.assertIsStrategyRegistered("glob")).toThrow(
        expect.objectContaining({
          id: "security.credentials.unknown_strategy",
        }),
      );
    });

    it("should accept a registered one", () => {
      listStrategies.mockReturnValue(["local", "oauth"]);

      expect(() =>
        controller.assertIsStrategyRegistered("local"),
      ).not.toThrow();
    });
  });

  describe("#assertNotExceedMaxFetch", () => {
    it("should throw past the configured limit", () => {
      global.kuzzle.config.limits.documentsFetchCount = 1;

      expect(() => controller.assertNotExceedMaxFetch(3)).toThrow(
        expect.objectContaining({ id: "services.storage.get_limit_exceeded" }),
      );
    });

    it("should accept a count at the limit", () => {
      global.kuzzle.config.limits.documentsFetchCount = 3;

      expect(() => controller.assertNotExceedMaxFetch(3)).not.toThrow();
    });
  });
});
