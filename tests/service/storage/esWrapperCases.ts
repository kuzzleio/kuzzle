import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExternalServiceError } from "../../../lib/kerror/errors/externalServiceError";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/**
 * The shared body of the ES 7 and ES 8 `esWrapper` specs.
 *
 * The two Mocha specs — `esWrapper-es7.test.js` and `esWrapper-es8.test.js`,
 * 188 lines each — were **byte-identical but for one import line**. Copying
 * them across would have put 188 duplicated lines in front of SonarCloud, and
 * `sonar.cpd.exclusions` may only shrink (TD-23): a third and fourth exclusion
 * is a decision to put to a human, not a default. So the cases live here once
 * and each version's spec file is four lines that name its own subject, which
 * keeps the `tests/` mirror intact for both.
 *
 * This is the shape [L5](../../../docs/adr-001/steps/13-sprint-10-test-closure.md#slices)
 * needs for the two 6 000-line `elasticsearch.ts` twins, proven small first.
 */
type ESWrapperClass = new (client: unknown) => {
  formatESError: (error: unknown) => Error & { id?: string };
};

/** The one thing an error's `meta` has to carry for the wrapper to read it. */
type ESError = Error & { body?: unknown; meta?: unknown };

/**
 * The client's own `ResponseError`, which the cases above cannot stand in for:
 * it exposes `body` as a prototype getter, not an own property.
 */
type ResponseErrorClass = new (meta: {
  body: unknown;
  headers: Record<string, string>;
  meta: Record<string, unknown>;
  statusCode: number;
  warnings: string[] | null;
}) => Error;

export function describeESWrapper(
  version: string,
  ESWrapper: ESWrapperClass,
  ResponseError: ResponseErrorClass,
) {
  describe(`#service/storage/${version}/esWrapper`, () => {
    let wrapper: InstanceType<ESWrapperClass>;
    let emit: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      /*
       * The wrapper turns a client error into a Kuzzle one and, in production,
       * emits the original for support. `emit` is the whole dependency; the
       * client is never called, so it is an empty object rather than a mock of
       * elasticsearch.
       */
      emit = vi.fn();
      stubKuzzle({ emit });
      wrapper = new ESWrapper({});
    });

    afterEach(() => {
      restoreKuzzle();
    });

    const withMeta = (message: string, meta: unknown): ESError =>
      Object.assign(new Error(message), { meta });

    describe("#formatESError", () => {
      /*
       * `catch` answers `unknown`, so a rejected client promise can carry
       * something that is not an Error at all. Everything below reads an
       * Error's shape; this is the normalisation that lets it.
       */
      it("accepts a thrown value that is not an Error", () => {
        const formatted = wrapper.formatESError("a bare string");

        expect(formatted).toBeInstanceOf(ExternalServiceError);
        expect(formatted.id).toBe("services.storage.unexpected_error");
      });

      it("converts an unknown error to an ExternalServiceError", () => {
        const formatted = wrapper.formatESError(
          withMeta("test", { statusCode: 420 }),
        );

        expect(formatted).toBeInstanceOf(ExternalServiceError);
        expect(formatted.id).toBe("services.storage.unexpected_error");
      });

      it("recognises a version conflict", () => {
        const formatted = wrapper.formatESError(
          withMeta(
            '[version_conflict_engine_exception] [data][AVrbg0eg90VMe4Z_dG8j]: version conflict, current version [153] is different than the one provided [152], with { index_uuid="iDrU6CfZSO6CghM1t6dl0A" & shard="2" & index="userglobaldata" }',
            { statusCode: 409 },
          ),
        );

        expect(formatted).toBeInstanceOf(ExternalServiceError);
        expect(formatted.id).toBe("services.storage.too_many_changes");
      });

      it("recognises a document that already exists", () => {
        const formatted = wrapper.formatESError(
          withMeta("", {
            body: {
              error: {
                reason:
                  "[liia]: version conflict, document already exists (current version [1])",
              },
            },
          }),
        );

        expect(formatted).toMatchObject({
          id: "services.storage.document_already_exists",
        });
      });

      it("names the index and collection of a document not found", () => {
        const error = withMeta("test", { statusCode: 404 });
        error.body = {
          _id: "mehry",
          _index: "&nyc-open-data.yellow-taxi",
          error: { reason: "foo", "resource.id": "bar" },
          found: false,
        };

        expect(wrapper.formatESError(error)).toMatchObject({
          id: "services.storage.not_found",
          message:
            'Document "mehry" not found in "nyc-open-data":"yellow-taxi".',
        });
      });

      it("names a document not found from the client's own ResponseError", () => {
        // A plain object built like the case above has `body` as an own
        // property, which is what hid a spread that lost the real one's.
        const error = new ResponseError({
          body: {
            _id: "mehry",
            _index: "&nyc-open-data.yellow-taxi",
            found: false,
          },
          headers: {},
          meta: {},
          statusCode: 404,
          warnings: null,
        });

        expect(wrapper.formatESError(error)).toMatchObject({
          id: "services.storage.not_found",
          message:
            'Document "mehry" not found in "nyc-open-data":"yellow-taxi".',
        });
      });

      it("falls back when a not-found carries no index", () => {
        const error = withMeta("test", { statusCode: 404 });
        error.body = {
          _id: "mehry",
          error: { reason: "foo", "resource.id": "bar" },
          found: false,
        };

        expect(wrapper.formatESError(error)).toMatchObject({
          id: "services.storage.unexpected_not_found",
          message: "test",
        });
      });

      it.each([
        "[and] query malformed, no start_object after query name",
        "no [query] registered for [equals]",
      ])("recognises an unknown DSL keyword: %s", (reason) => {
        const error = withMeta("", { body: { error: { reason } } });

        expect(wrapper.formatESError(error)).toMatchObject({
          id: "services.storage.unknown_query_keyword",
        });
      });

      /*
       * The Mocha specs wrapped these in a `describe("logging in production")`
       * that set `global.NODE_ENV = "production"` — and there is **no such
       * branch**: `formatESError` emits unconditionally, in every environment.
       * The setup was decorative, and it read as a guarantee the subject does
       * not make. Dropped, and the unconditional emit is what is asserted.
       */
      describe("emitting the source error", () => {
        it("emits it for support and debugging", () => {
          const error = withMeta("test", {
            meta: { request: { oh: "noes" } },
            statusCode: 420,
          });

          wrapper.formatESError(error);

          expect(emit).toHaveBeenCalledWith("services:storage:error", {
            message: `Elasticsearch Client error: ${error.message}`,
            meta: error.meta,
            stack: error.stack,
          });
        });

        it("emits null for an error that carries no meta", () => {
          const error = new Error("test");

          wrapper.formatESError(error);

          expect(emit).toHaveBeenCalledWith("services:storage:error", {
            message: `Elasticsearch Client error: ${error.message}`,
            meta: null,
            stack: error.stack,
          });
        });

        it.each(["production", "development"])(
          "emits in %s alike — there is no environment guard",
          (env) => {
            global.NODE_ENV = env;

            wrapper.formatESError(withMeta("test", { statusCode: 420 }));

            expect(emit).toHaveBeenCalledTimes(1);
          },
        );
      });
    });
  });
}
