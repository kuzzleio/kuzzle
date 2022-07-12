"use strict";

const { Then, When } = require("cucumber"),
  Bluebird = require("bluebird"),
  should = require("should");

When(
  /^I call the (.*?) method of the memory storage with arguments$/,
  function (command, args) {
    let realArgs = args
      ? JSON.parse(args.replace(/#prefix#/g, this.idPrefix))
      : args;

    return this.api.callMemoryStorage(command, realArgs).then((response) => {
      if (response.error) {
        return Bluebird.reject(response.error);
      }

      this.memoryStorageResult = response;

      return response;
    });
  }
);

When(
  /^I scan the database using the (.+?) method with arguments$/,
  function (command, args) {
    const parsed = JSON.parse(args.replace(/#prefix#/g, this.idPrefix));

    if (parsed.args) {
      parsed.args.cursor = 0;
    } else {
      parsed.args = { cursor: 0 };
    }

    this.memoryStorageResult = null;

    return scanRedis(this, command, parsed);
  }
);

Then(
  /^The (sorted )?ms result should match the (regex|json) (.*?)$/,
  function (sorted, type, pattern, callback) {
    let regex,
      val = this.memoryStorageResult.result;

    if (sorted && Array.isArray(val)) {
      val = val.sort();
    }

    if (type === "regex") {
      regex = new RegExp(pattern.replace(/#prefix#/g, this.idPrefix));
      if (regex.test(val.toString())) {
        callback();
      } else {
        callback(
          new Error(
            "pattern mismatch: \n" +
              JSON.stringify(val) +
              "\n does not match \n" +
              regex
          )
        );
      }
    }

    if (type === "json") {
      pattern = pattern.replace(/#prefix#/g, this.idPrefix);

      try {
        should(JSON.parse(pattern)).be.eql(val);
        callback();
      } catch (err) {
        return callback(
          new Error(
            "Error: " + JSON.stringify(val) + " does not match " + pattern
          )
        );
      }
    }
  }
);

/**
 * Executes on of the *scan family command, recursively, until
 * the scan completes
 *
 * @param {object} world - functional tests global object
 * @param {string} command - name of the scan command (scan, hscan, sscan, zscan)
 * @param {object} args - scan arguments
 * @returns {Bluebird<object>}
 */
function scanRedis(world, command, args) {
  return world.api.callMemoryStorage(command, args).then((response) => {
    if (response.error) {
      return Bluebird.reject(response.error);
    }

    if (world.memoryStorageResult === null) {
      world.memoryStorageResult = { result: response.result[1] };
    } else {
      world.memoryStorageResult.result.push(...response.result[1]);
    }

    // advance the cursor to its next position
    args.args.cursor = Number.parseInt(response.result[0]);

    return args.args.cursor === 0
      ? world.memoryStorageResult
      : scanRedis(world, command, args);
  });
}
