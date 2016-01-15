var
  _ = require('lodash'),
  jwt = require('jsonwebtoken');

module.exports = function () {
  this.When(/^I set a user token for user id "(.*?)"$/, function (userId, callback) {
    if (this.currentUser === null) {
      this.currentUser = {};
    }

    this.currentUser.token = jwt.sign({_id: userId}, this.kuzzleConfig.jsonWebToken.secret, {algorithm: this.kuzzleConfig.jsonWebToken.algorithm});

    callback();
  });

  this.Then(/^I reset the current user token$/, function (callback) {
    delete this.currentUser.token;
    if (_.isEmpty(this.currentUser)) {
      this.currentUser = null;
    }

    callback();
  });
};
