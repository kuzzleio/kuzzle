import { When, Then } from "@cucumber/cucumber";
import async from "async";

const validSpecifications = {
    fields: {
      myField: {
        defaultValue: 42,
        mandatory: true,
        type: "integer",
      },
    },
    strict: true,
  },
  notValidSpecifications = {
    fields: {
      myField: {
        defaultValue: 42,
        mandatory: true,
        type: "not valid",
      },
    },
    strict: true,
  },
  validDocument = {
    myField: 42,
  },
  notValidDocument = {
    myField: "fooBarBaz",
  };

When(
  /^There is (no)?(a)? specifications? for index "([^"]*)" and collection "([^"]*)"$/,
  {},
  function (no, some, index, collection, callback) {
    const idx = index ? index : this.fakeIndex,
      coll = collection ? collection : this.fakeCollection;

    this.api
      .getSpecifications(idx, coll)
      .then((body) => {
        if (body.error) {
          if (no) {
            return callback();
          }
          return callback(new Error(body.error.message));
        }

        if (no) {
          return callback(new Error(JSON.stringify(body)));
        }
        return callback();
      })
      .catch((error) => callback(no ? null : error));
  },
);

Then(
  /^I put a (not )?valid ?specification for index "([^"]*)" and collection "([^"]*)"$/,
  {},
  function (not, index, collection, callback) {
    const idx = index ? index : this.fakeIndex,
      coll = collection ? collection : this.fakeCollection,
      specifications = not ? notValidSpecifications : validSpecifications,
      body = specifications;

    this.api
      .updateSpecifications(idx, coll, body)
      .then((_body) => {
        this.statusCode = _body.status;
        if (not) {
          return callback(new Error(JSON.stringify(_body)));
        }
        return callback();
      })
      .catch((error) => {
        this.statusCode = error.statusCode;
        if (not) {
          return callback();
        }
        callback(error);
      });
  },
);

Then(
  /^There is (an)?(no)? error message( in the response body)?$/,
  {},
  function (noError, withError, inBody, callback) {
    if (this.statusCode !== 200) {
      if (noError) {
        if (inBody) {
          // we should always have a 200 response status, error whould be in the response body
          return callback(
            new Error(
              "Status code is " + this.statusCode + ", but 200 was expected",
            ),
          );
        }
        return callback();
      }
      return callback(
        new Error(
          "Status code is " + this.statusCode + ", but 200 was expected",
        ),
      );
    }

    // Status is 200
    if (noError) {
      if (inBody) {
        if (
          this.body.result.valid === false &&
          this.body.result.details &&
          this.body.result.description
        ) {
          return callback();
        }
        return callback(new Error(JSON.stringify(this.body)));
      }
      return callback(
        new Error(
          "Status code is " + this.statusCode + ", but an error was expected",
        ),
      );
    }

    return callback();
  },
);

When(/^I post a(n in)? ?valid ?specification$/, {}, function (not, callback) {
  const index = this.fakeIndex,
    collection = this.fakeCollection,
    specifications = not ? notValidSpecifications : validSpecifications,
    body = specifications;

  this.api
    .validateSpecifications(index, collection, body)
    .then((_body) => {
      this.statusCode = _body.status;
      this.body = _body;

      // an invalid specification is not a bad request, the request may go well despite of an invalid spec
      // according to this, we should always have a 200 status if no other internal nor access error occure

      return callback();
    })
    .catch((error) => {
      this.statusCode = error.statusCode;
      return callback(error);
    });
});

When(/^I post a(n in)? ?valid document/, {}, function (not, callback) {
  const index = this.fakeIndex,
    collection = this.fakeCollection,
    document = not ? notValidDocument : validDocument;

  this.api
    .postDocument(index, collection, document)
    .then((body) => {
      this.statusCode = body.status;
      if (not) {
        return callback(new Error(JSON.stringify(body)));
      }
      return callback();
    })
    .catch((error) => {
      this.statusCode = error.statusCode;
      if (not) {
        return callback();
      }
      callback(error);
    });
});

When(
  /^I delete the specifications (again )?for index "([^"]*)" and collection "([^"]*)"$/,
  {},
  function (again, index, collection, callback) {
    const idx = index ? index : this.fakeIndex,
      coll = collection ? collection : this.fakeCollection;

    this.api
      .deleteSpecifications(idx, coll)
      .then((body) => {
        this.statusCode = body.status;
        callback();

        return null;
      })
      .catch((error) => {
        this.statusCode = error.statusCode;
        callback();

        return null;
      });
  },
);

Then(
  /^I find (\d+) specifications(?: with scroll "([^"]+)")?/,
  function (hits, scroll, callback) {
    this.scrollId = null;

    hits = Number.parseInt(hits);

    const search = function (callbackAsync) {
      setTimeout(() => {
        this.api
          .searchSpecifications({}, scroll && { scroll })
          .then((response) => {
            if (response.error) {
              return callbackAsync(new Error(response.error.message));
            }

            if (scroll && !response.result.scrollId) {
              return callbackAsync(
                new Error("No scrollId returned by the searchProfile query"),
              );
            }

            if (
              response.result.hits === undefined ||
              response.result.total === undefined
            ) {
              return callbackAsync(new Error("Malformed search results"));
            }

            if (
              response.result.hits.length !== hits ||
              response.result.total !== hits
            ) {
              return callbackAsync(
                new Error(
                  `Wrong number of results. Expected: ${hits}, got ${response.result.hits.length} (or ${response.result.total})`,
                ),
              );
            }

            this.scrollId = response.result.scrollId;
            callbackAsync();
          })
          .catch((err) => callbackAsync(err));
      }, 200);
    };

    async.retry(20, search.bind(this), function (err) {
      if (err) {
        return callback(new Error(err));
      }

      callback();
    });
  },
);

Then(/^I am able to perform a scrollSpecifications request$/, function () {
  if (!this.scrollId) {
    throw new Error("No previous scrollId found");
  }

  return this.api.scrollSpecifications(this.scrollId).then((response) => {
    if (response.error) {
      throw new Error(response.error.message);
    }

    if (
      ["hits", "scrollId", "total"].some(
        (prop) => response.result[prop] === undefined,
      )
    ) {
      throw new Error("Incomplete scroll results");
    }
  });
});
