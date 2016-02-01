var apiSteps = function () {
  this.When(/^I log in as (.*?):(.*?)$/, function (login, password, callback) {
    this.api.login('local', {username: this.idPrefix + login, password: password})
      .then(body => {
        console.log("### body: ", body);
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

        if (this.currentUser === null) {
          this.currentUser = {};
        }

        this.currentUser.token = body.result.jwt;
        callback();
      })
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I log ?out$/, function (callback) {
    if (!this.currentUser || !this.currentUser.token) {
      callback(new Error('Cannot retrieve jwt token'));
      return false;
    }

    this.api.logout(this.jwtToken)
      .then(body => {
        delete this.currentUser;

        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }
        callback();
      })
      .catch(error => {
        delete this.currentUser;
        callback(error);
      });
  });
};

module.exports = apiSteps;
