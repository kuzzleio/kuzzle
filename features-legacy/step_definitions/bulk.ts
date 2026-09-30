import should from "should";
import { Then, When } from "@cucumber/cucumber";
import async from "async";
import {
  asError,
  type AsyncCallback,
  type RetryFailure,
} from "../support/stepUtils";
import type KWorld from "../support/world";

Then(
  /^I can retrieve actions from bulk import$/,
  function (this: KWorld, callback) {
    const main = function (this: KWorld, callbackAsync: AsyncCallback) {
      setTimeout(() => {
        // execute in parallel both tests: test if create/update work well and test if delete works well
        async.parallelLimit<void, RetryFailure>(
          {
            testUpdate: (callbackAsyncParallel: AsyncCallback) => {
              this.api
                .get("1")
                .then((body) => {
                  if (body.error !== null) {
                    callbackAsyncParallel(body.error.message);
                    return false;
                  }

                  if (
                    body.result &&
                    body.result._source &&
                    body.result._source.title === "foobar"
                  ) {
                    callbackAsyncParallel();
                    return false;
                  }

                  callbackAsyncParallel(
                    "Document was not updated or created successfully in bulk import",
                  );
                })
                .catch(function (error) {
                  callbackAsyncParallel(error);
                });
            },
            testDelete: (callbackAsyncParallel: AsyncCallback) => {
              this.api
                .get("2")
                .then((body) => {
                  if (body.error !== null) {
                    callbackAsyncParallel();
                    return false;
                  }

                  if (body.result && body.result._source) {
                    callbackAsyncParallel("Document still exists");
                    return false;
                  }

                  callback();
                })
                .catch(function () {
                  callbackAsyncParallel();
                });
            },
          },
          1,
          (error) => {
            // Only when we have response from async.parallelLimit we can stop retry by calling callbackAsync
            if (error) {
              callbackAsync(error);
              return;
            }

            callbackAsync();
          },
        ); // end async.parallel
      }, 20); // end setTimeout
    }; // end method main

    async.retry<void, RetryFailure>(20, main.bind(this), (failure) => {
      if (failure) {
        callback(asError(failure));
        return;
      }

      callback();
    });
  },
);

When(
  /^I ?(can't)* do a bulk import(?: from index "([^"]*)")?$/,
  function (this: KWorld, not, index, callback) {
    this.api
      .bulkImport(this.bulk, index)
      .then((body) => {
        if (body.error !== null) {
          if (not) {
            callback();
            return;
          }
          callback(new Error(body.error.message));
          return false;
        }

        if (not) {
          callback(
            new Error("User can do a bulk import on a restricted index"),
          );
          return false;
        }
        callback();
      })
      .catch(function (error) {
        if (not) {
          callback();
          return;
        }
        callback(error);
      });
  },
);

When("I use bulk:mWrite action with", function (this: KWorld, bodyRaw) {
  const body = JSON.parse(bodyRaw);

  return this.api.bulkMWrite(this.fakeIndex, this.fakeCollection, body);
});

When("I use bulk:write action with {string}", function (this: KWorld, bodyRaw) {
  const body = JSON.parse(bodyRaw);

  return this.api.bulkWrite(this.fakeIndex, this.fakeCollection, body);
});

When(
  "I use bulk:write action with id {string} and content {string}",
  function (this: KWorld, id, bodyRaw) {
    const body = JSON.parse(bodyRaw);

    return this.api.bulkWrite(this.fakeIndex, this.fakeCollection, body, id);
  },
);

Then("The documents does not have kuzzle metadata", function (this: KWorld) {
  return this.api
    .search({}, this.fakeIndex, this.fakeCollection, { size: 100 })
    .then(({ result }) => {
      for (const hit of result.hits) {
        should(hit._source._kuzzle_info).be.undefined();
      }
    });
});

Then(
  "The documents have the following kuzzle metadata {string}",
  function (this: KWorld, metadatRaw) {
    const metadata = JSON.parse(metadatRaw);

    return this.api
      .search({}, this.fakeIndex, this.fakeCollection, { size: 100 })
      .then(({ result }) => {
        for (const hit of result.hits) {
          should(hit._source._kuzzle_info).match(metadata);
        }
      });
  },
);

Then("I can found a document {string}", function (this: KWorld, documentId) {
  return this.api.get(documentId, this.fakeIndex, this.fakeCollection);
});
