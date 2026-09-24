import { Then } from "@cucumber/cucumber";
import _ from "lodash";
import async from "async";
import {
  asError,
  type AsyncCallback,
  type RetryFailure,
} from "../support/stepUtils";
import type KWorld from "../support/world";

Then(
  /^I count ([\d]*) documents(?: in index "([^"]*)"(:"([\w-]+)")?)?$/,
  function (this: KWorld, number, index, collection, callback) {
    const main = function (this: KWorld, callbackAsync: AsyncCallback) {
      setTimeout(() => {
        if (_.isFunction(collection)) {
          callback = collection;
          collection = undefined;
        }

        this.api
          .count({}, index, collection)
          .then((body) => {
            if (body.result.count !== parseInt(number)) {
              callbackAsync(
                "No correct value for count. Expected " +
                  number +
                  ", got " +
                  body.result.count,
              );
              return false;
            }

            callbackAsync();
          })
          .catch((error) => callbackAsync(error));
      }, 100); // end setTimeout
    };

    async.retry<void, RetryFailure>(20, main.bind(this), (err) => {
      if (err) {
        callback(asError(err));
        return;
      }

      callback();
    });
  },
);

Then(
  /^I count ([\d]*) documents with "([^"]*)" in field "([^"]*)(?: in index "([^"]*)")?"/,
  function (this: KWorld, number, value, field, index, callback) {
    const main = function (this: KWorld, callbackAsync: AsyncCallback) {
      setTimeout(
        function (this: KWorld) {
          const query = {
            query: {
              match: { [field]: value },
            },
          };

          this.api
            .count(query, index)
            .then((body) => {
              if (body.error) {
                callbackAsync(body.error.message);
                return false;
              }

              if (body.result.count !== parseInt(number)) {
                callbackAsync(
                  "Wrong document count received. Expected " +
                    number +
                    ", got " +
                    body.result.count,
                );
                return false;
              }

              callbackAsync();
            })
            .catch(function (error) {
              callbackAsync(new Error(error));
            });
        }.bind(this),
        20,
      );
    };

    async.retry<void, RetryFailure>(20, main.bind(this), (error) => {
      if (error) {
        callback(asError(error));
        return;
      }

      callback();
    });
  },
);
