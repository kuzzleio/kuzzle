import { Then } from "@cucumber/cucumber";
import async from "async";
import {
  asError,
  type AsyncCallback,
  realtimeApi,
  type RetryFailure,
} from "../support/stepUtils";
import type KWorld from "../support/world";

Then(
  /^I should receive a ?(.*?) notification with field ?(.*?) equal to "([^"]*)"$/,
  function (this: KWorld, type, field, value, callback) {
    const main = (callbackAsync: AsyncCallback) => {
      setTimeout(() => {
        if (realtimeApi(this).responses) {
          if (realtimeApi(this).responses.type !== type) {
            callbackAsync(
              `Wrong notification type received: ${realtimeApi(this).responses.type}. Expected: ${type}`,
            );
            return false;
          }

          if (realtimeApi(this).responses[field] !== value) {
            return callbackAsync(
              `Expected notification field "${field}" to be equal to "${value}", but got "${realtimeApi(this).responses[field]}" instead.`,
            );
          }

          callbackAsync();
        } else {
          callbackAsync("No notification received");
        }
      }, 100);
    };

    async.retry<void, RetryFailure>(20, main, (failure) => {
      if (failure) {
        callback(asError(failure));
        return;
      }

      callback();
    });
  },
);

Then(
  /^The notification should have "([^"]*)" array with ([\d]*) element/,
  function (this: KWorld, member, n_elements, callback) {
    if (
      realtimeApi(this).responses.result[member].length === parseInt(n_elements)
    ) {
      callback();
    } else {
      console.log("Wrong notification received: ");
      console.dir(realtimeApi(this).responses, { colors: true, depth: null });
      callback(
        new Error(
          `The document was supposed to contain the member "${member}" with ${n_elements} elements: Has ${realtimeApi(this).responses.result[member].length}.`,
        ),
      );
    }
  },
);

Then(
  /^The notification should ?(not)* have a "([^"]*)" member/,
  function (this: KWorld, not, member, callback) {
    if (
      (realtimeApi(this).responses.result[member] || not) &&
      !(realtimeApi(this).responses.result[member] && not)
    ) {
      callback();
    } else {
      console.log("Wrong notification received: ");
      console.dir(realtimeApi(this).responses, { colors: true, depth: null });
      callback(
        new Error(
          `The document was ${not ? "not " : ""} supposed to contain the member "${member}"`,
        ),
      );
    }
  },
);

Then(
  /^The notification should have volatile/,
  function (this: KWorld, callback) {
    if (!realtimeApi(this).responses.volatile) {
      return callback(
        new Error("Expected volatile in the notification but none was found"),
      );
    }

    let diff =
      Object.keys(this.volatile).length !==
      Object.keys(realtimeApi(this).responses.volatile).length;

    for (const key of Object.keys(this.volatile)) {
      if (!diff) {
        if (!realtimeApi(this).responses.volatile[key]) {
          diff = true;
        } else {
          diff =
            JSON.stringify(this.volatile[key]).localeCompare(
              JSON.stringify(realtimeApi(this).responses.volatile[key]),
            ) !== 0;
        }
      }
    }

    if (diff) {
      callback(
        new Error(
          `Expected ${JSON.stringify(realtimeApi(this).responses.volatile)} to match ${JSON.stringify(this.volatile)}`,
        ),
      );
    } else {
      callback();
    }
  },
);
