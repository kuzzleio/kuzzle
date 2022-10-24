"use strict";

const { Given, When, Then } = require("cucumber");
const async = require("async");

Given("an index {string}", async function (index) {
  this.props.result = await this.sdk.index.create(index);

  this.props.index = index;
});

When(
  "I create a virtual index named {string} referencing {string}",
  async function (index, realIndex) {
    const body = await this.sdk.query({
      index: index,
      controller: "index",
      action: "createVirtual",
      physicalIndex: realIndex,
    });
    this.props.index = index;

    if (body.error) {
      throw new Error(body.error.message);
    }
  }
);

Given("a index {string}", async function (index) {
  this.props.result = await this.sdk.index.create(index);

  this.props.index = index;
});

Then(
  /^I can?('t)* find the index named "([^"]*)" in index list$/,
  function (not, index, callback) {
    var main = function (callbackAsync) {
      this.sdk.index
        .list()
        .then((body) => {
          if (body.indexOf(index) !== -1) {
            if (not) {
              callbackAsync("Index " + index + " exists");
              return false;
            }

            callbackAsync();
            return true;
          }

          if (not) {
            callbackAsync();
            return true;
          }

          callbackAsync("Index " + index + " is missing");
        })
        .catch(function (error) {
          if (not) {
            callbackAsync();
            return false;
          }

          callbackAsync(error);
          return true;
        });
    };

    async.retry({ times: 20, interval: 20 }, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }
        callback(new Error(err));
        return false;
      }
      callback();
    });
  }
);

Then(
  /^I'm able to delete the index named "([^"]*)"$/,
  function (index, callback) {
    this.sdk.index
      .delete(index)
      .then(() => {
        callback();
      })
      .catch((error) => callback(error));
  }
);
