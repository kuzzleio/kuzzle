import { When, Then } from "@cucumber/cucumber";

When(/^I get the last statistics frame$/, function (callback) {
  this.api
    .getLastStats()
    .then(
      function (response) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error("No result provided"));
        }

        this.result = response.result;
        callback();
      }.bind(this),
    )
    .catch(function (error) {
      callback(error);
    });
});

When(/^I get the statistics frame from a date$/, function (callback) {
  this.api
    .getStats({
      startTime: new Date().getTime() - 1000000,
      stopTime: undefined,
    })
    .then(
      function (response) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error("No result provided"));
        }

        this.result = response.result;
        callback();
      }.bind(this),
    )
    .catch(function (error) {
      callback(error);
    });
});

When(/^I get all statistics frames$/, function (callback) {
  this.api
    .getAllStats()
    .then(
      function (response) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error("No result provided"));
        }

        this.result = response.result;
        callback();
      }.bind(this),
    )
    .catch(function (error) {
      callback(error);
    });
});

Then(/^I get at least 1 statistic frame$/, function (callback) {
  if (!this.result) {
    return callback(
      new Error("Expected a statistics result, got: " + this.result),
    );
  }

  if (
    this.result.hits &&
    this.result.hits.length > 0 &&
    this.result.hits[0].ongoingRequests &&
    this.result.hits[0].completedRequests &&
    this.result.hits[0].failedRequests &&
    this.result.hits[0].connections
  ) {
    return callback();
  }

  if (
    this.result.ongoingRequests &&
    this.result.completedRequests &&
    this.result.failedRequests &&
    this.result.connections
  ) {
    return callback();
  }

  callback(
    new Error("Expected at least 1 statistic frame, found: " + this.result),
  );
});
