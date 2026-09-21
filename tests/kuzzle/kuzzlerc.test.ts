import fs from "fs";

import stripJson from "strip-json-comments";
import { describe, expect, it } from "vitest";

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
});
