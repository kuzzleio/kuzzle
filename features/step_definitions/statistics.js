var
  _ = require('lodash');

var apiSteps = function () {
  this.When(/^I get the last statistics frame$/, function (callback) {
    this.api.getLastStats()
      .then(function (response) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        this.result = response.result;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.When(/^I get the statistics frame from a date$/, function (callback) {
    this.api.getStats({startTime: new Date().getTime()-1000000, stopTime: undefined})
      .then(function (response) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        this.result = response.result;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.When(/^I get all statistics frames$/, function (callback) {
    this.api.getAllStats()
      .then(function (response) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        this.result = response.result;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I get at least 1 statistic frame$/, function (callback) {
    if (!this.result.statistics) {
      return callback('Expected a statistics result, got: ' + this.result);
    }

    if (_.isArray(this.result.statistics) &&
      this.result.statistics.length > 0 &&
      this.result.statistics[0].ongoingRequests &&
      this.result.statistics[0].completedRequests &&
      this.result.statistics[0].failedRequests &&
      this.result.statistics[0].connections) {
      return callback();
    }

    if (this.result.statistics.ongoingRequests &&
      this.result.statistics.completedRequests &&
      this.result.statistics.failedRequests &&
      this.result.statistics.connections) {
      return callback();
    }

    callback('Expected at least 1 statistic frame, found: ' + this.result.statistics);
  });
};

module.exports = apiSteps;
