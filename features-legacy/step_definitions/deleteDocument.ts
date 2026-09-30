import { Then } from "@cucumber/cucumber";
import async from "async";
import {
  asError,
  type AsyncCallback,
  type RetryFailure,
} from "../support/stepUtils";
import type KWorld from "../support/world";

Then(
  /^I remove the document(?: in index "([^"]*)")?$/,
  function (this: KWorld, index, callback) {
    this.api
      .deleteById(this.result._id, index)
      .then((body) => {
        if (body.error !== null) {
          callback(body.error.message);
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(error);
      });
  },
);

Then(
  /^I remove documents with field "([^"]*)" equals to value "([^"]*)"(?: in index "([^"]*)")?$/,
  function (this: KWorld, field, value, index, callback) {
    const main = function (this: KWorld, callbackAsync: AsyncCallback) {
      setTimeout(
        function (this: KWorld) {
          const query = { query: { match: { [field]: value } } };

          this.api
            .deleteByQuery(query, index)
            .then((body) => {
              if (body.error) {
                callbackAsync(body.error.message);
                return false;
              }

              if (!body.result || body.result.ids.length === 0) {
                callbackAsync("No result provided");
                return false;
              }

              callbackAsync();
            })
            .catch(function (error) {
              callbackAsync(error);
            });
        }.bind(this),
        20,
      ); // end setTimeout
    };

    async.retry<void, RetryFailure>(20, main.bind(this), (failure) => {
      if (failure) {
        callback(asError(failure));
        return;
      }

      callback();
    });
  },
);

Then(
  /^I remove the documents '([^']+)'( and get partial errors)?$/,
  function (this: KWorld, documents, withErrors, callback) {
    documents = JSON.parse(documents);

    this.api
      .mDelete({ ids: documents })
      .then((response) => {
        if (response.error && !withErrors) {
          callback(response.error.message);
          return false;
        } else if (!response.error && withErrors) {
          callback("Should get partial error");
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(error);
      });
  },
);
