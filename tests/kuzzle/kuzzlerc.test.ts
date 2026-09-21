import { describe, it } from "vitest";

import stripJson from "strip-json-comments";
import fs from "fs";

describe(".kuzzlerc.sample.jsonc", () => {
  it("is able to load the kuzzlerc sample file without errors", () => {
    const content = fs.readFileSync(
      `${__dirname}/../../.kuzzlerc.sample.jsonc`,
    );
    const stripped = stripJson(content.toString());

    // throw if malformed
    try {
      JSON.parse(stripped);
    } catch (e) {
      // eslint-disable-next-line
      console.error(stripped);
      throw e;
    }
  });
});
