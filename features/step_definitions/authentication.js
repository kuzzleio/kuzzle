var apiSteps = function () {
  this.When(/^I send a login request with test:testpwd user?$/, function (callback) {
    this.api.login('local', {username: 'test', password:'testpwd'})
      .then(function (body) {
        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }

        if (!body.result) {
          callback(new Error('No result provided'));
          return false;
        }

        if (!body.result.jwt) {
          callback(new Error('No token received'));
          return false;
        }

        this.jwtToken = body.result.jwt;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I send a logout request with previously received token?$/, function (callback) {
    if (!Boolean(this.jwtToken)) {
      callback(new Error('Cannot retrieve jwt token'));
      return false;
    }

    this.api.logout(this.jwtToken)
      .then(function (body) {
        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }
        callback();
      });
  });
};

module.exports = apiSteps;
