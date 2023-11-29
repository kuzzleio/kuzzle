"use strict";

const stripJson = require("strip-json-comments");
const fs = require("fs");

describe(".kuzzlerc.sample.jsonc", () => {
  it("should be able to load the kuzzlerc sample file without errors", () => {
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
