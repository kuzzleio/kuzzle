"use strict";

const { Then } = require("cucumber"),
  _ = require("lodash"),
  async = require("async");

Then(
  /^I count ([\d]*) documents(?: in index "([^"]*)"(:"([\w-]+)")?)?$/,
  function (number, index, collection, callback) {
    var main = function (callbackAsync) {
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
                  body.result.count
              );
              return false;
            }

            callbackAsync();
          })
          .catch((error) => callbackAsync(error));
      }, 100); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = `${err.statusCode}: ${err.message}`;
        }

        callback(new Error(err));
        return false;
      }

      callback();
    });
  }
);

Then(
  /^I count ([\d]*) documents with "([^"]*)" in field "([^"]*)(?: in index "([^"]*)")?"/,
  function (number, value, field, index, callback) {
    var main = function (callbackAsync) {
      setTimeout(
        function () {
          var query = {
            query: {
              match: {},
            },
          };

          query.query.match[field] = value;

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
                    body.result.count
                );
                return false;
              }

              callbackAsync();
            })
            .catch(function (error) {
              callbackAsync(new Error(error));
            });
        }.bind(this),
        20
      );
    };

    async.retry(20, main.bind(this), function (error) {
      if (error) {
        callback(new Error(error));
        return false;
      }

      callback();
    });
  }
);
