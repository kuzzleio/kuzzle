import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import printDidYouMean from "../../lib/util/didYouMean";
import didYouMean from "didyoumean";

/**
 * The suggestion library is what this wrapper wraps, so it is what the spec
 * drives. Mocking the module — rather than rewiring the wrapper's binding to
 * it — is also what paid off the last `import … = require()` in `lib/`: the
 * Mocha spec addressed the *compiled* variable by name, which a default import
 * would have renamed to `didyoumean_1.default`, so the subject could not use
 * one while that spec existed.
 */
vi.mock("didyoumean", () => ({ default: vi.fn() }));

const suggest = vi.mocked(didYouMean);

describe("#util/didYouMean", () => {
  let nodeEnv: string | undefined;

  beforeEach(() => {
    /* The subject reads `global.NODE_ENV`, not `process.env.NODE_ENV`. The
     * Mocha spec only ever set the latter and passed by accident, on a global
     * another spec had left behind (step 13, L1b4). */
    nodeEnv = global.NODE_ENV;
    global.NODE_ENV = "development";

    suggest.mockReset();
  });

  afterEach(() => {
    global.NODE_ENV = nodeEnv;
  });

  it("should ask the library for the closest match", () => {
    printDidYouMean("item", ["foo", "bar"]);

    expect(suggest).toHaveBeenCalledExactlyOnceWith("item", ["foo", "bar"]);
  });

  it("should answer the suggestion as a sentence", () => {
    suggest.mockReturnValue("foo");

    expect(printDidYouMean("item", ["foo", "bar"])).toBe(
      ' Did you mean "foo"?',
    );
  });

  it("should answer nothing when the library found no match", () => {
    suggest.mockReturnValue(null);

    expect(printDidYouMean("item", ["foo", "bar"])).toBe("");
  });

  /* The suggestion is a development aid: outside development it is not
   * computed at all, which is the point of the guard. */
  it("should answer nothing outside development, without asking", () => {
    global.NODE_ENV = "production";

    expect(printDidYouMean("item", ["foo", "bar"])).toBe("");
    expect(suggest).not.toHaveBeenCalled();
  });

  it("should answer nothing when NODE_ENV is not set at all", () => {
    delete (global as { NODE_ENV?: string }).NODE_ENV;

    expect(printDidYouMean("item", ["foo", "bar"])).toBe("");
    expect(suggest).not.toHaveBeenCalled();
  });

  /* `didyoumean` answers `""` for an empty candidate list, and the wrapper's
   * falsy check is what turns that into no sentence rather than
   * `Did you mean ""?`. */
  it("should answer nothing for an empty suggestion", () => {
    suggest.mockReturnValue("");

    expect(printDidYouMean("item", [])).toBe("");
  });
});
