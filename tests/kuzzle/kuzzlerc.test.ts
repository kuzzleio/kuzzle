import fs from "fs";

import stripJson from "strip-json-comments";
import { describe, expect, it } from "vitest";

import defaultConfig from "../../lib/config/default.config";

function loadSample() {
  const content = fs.readFileSync(`${__dirname}/../../.kuzzlerc.sample.jsonc`);

  return JSON.parse(stripJson(content.toString()));
}

describe(".kuzzlerc.sample.jsonc", () => {
  // The Mocha spec asserted nothing: it parsed the file and let a throw fail
  // the test, which works but says "this test has no expectation" to anything
  // reading it — SonarCloud's S2699 among them. The claim is that the sample
  // shipped with the package is valid JSONC, so that is what is asserted.
  //
  // `__dirname` is `tests/kuzzle` here; under Mocha it was `dist/test/kuzzle`,
  // one level deeper, and the path carried a third `..`.
  it("parses the shipped sample as JSONC", () => {
    const content = fs.readFileSync(
      `${__dirname}/../../.kuzzlerc.sample.jsonc`,
    );

    const parsed = JSON.parse(stripJson(content.toString()));

    expect(parsed).toBeInstanceOf(Object);
    // A sample that parses to `{}` would pass the line above and tell the
    // reader nothing: the file exists to document the configuration.
    expect(Object.keys(parsed).length).toBeGreaterThan(0);
  });

  // The sample is read as the reference of the defaults; it had drifted from
  // them (`concurrentRequests: 50` against 100, no `authToken` section). The
  // sections below are the ones whose values are the defaults, not examples.
  it.each(["limits", "security.authToken", "security.jwt"])(
    "documents the code defaults of %s",
    (section) => {
      const pick = (config: Record<string, unknown>) =>
        section
          .split(".")
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown>)[key],
            config,
          );

      expect(pick(loadSample())).toEqual(pick(defaultConfig));
    },
  );
});
