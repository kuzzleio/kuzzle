"use strict";

const { Then } = require("cucumber"),
  async = require("async");

Then(
  /^I remove the document(?: in index "([^"]*)")?$/,
  function (index, callback) {
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
  }
);

Then(
  /^I remove documents with field "([^"]*)" equals to value "([^"]*)"(?: in index "([^"]*)")?$/,
  function (field, value, index, callback) {
    const main = function (callbackAsync) {
      setTimeout(
        function () {
          const query = { query: { match: {} } };

          query.query.match[field] = value;

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
        20
      ); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        callback(err);
        return false;
      }

      callback();
    });
  }
);

Then(
  /^I remove the documents '([^']+)'( and get partial errors)?$/,
  function (documents, withErrors, callback) {
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
  }
);
