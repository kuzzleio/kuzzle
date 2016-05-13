var apiSteps = function () {
  this.When(/^I log in as (.*?):(.*?) expiring in (.*?)$/, function (login, password, expiration, callback) {
    this.api.login('local', {username: this.idPrefix + login, password: password, expiresIn: expiration})
      .then(body => {
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

        if (this.currentUser === null || this.currentUser === undefined) {
          this.currentUser = {};
        }

        this.currentToken = { jwt: body.result.jwt };
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

    this.api.logout(this.currentUser.token)
      .then(body => {
        delete this.currentUser;
        if (body.error) {
          return callback(new Error(body.error.message));
        }
        callback();
      })
      .catch(error => {
        delete this.currentUser;
        callback(error);
      });
  });

  this.Then(/^I check the JWT Token$/, function (callback) {
    if (!this.currentToken || !this.currentToken.jwt) {
      return callback(new Error('Cannot retrieve the JWT token'));
    }

    this.api.checkToken(this.currentToken.jwt)
      .then(body => {
        if (body.error) {
          return callback(new Error(body.error.message));
        }

        this.currentToken.tokenValidity = body.result;
        callback();
      })
      .catch(err => callback(err));
  });

  this.Then(/^The token is (.*?)$/, function (state, callback) {
    if (!this.currentToken || !this.currentToken.tokenValidity) {
      return callback(new Error('Cannot check the JWT token validity'));
    }

    if (this.currentToken.tokenValidity.valid === (state === 'valid')) {
      return callback();
    }

    callback(new Error('Expected token to be ' + state + ', got: ' + JSON.stringify(this.currentToken.tokenValidity)));
  });
  
  this.Then(/^I update current user with data \{(.*?)}$/, function (dataBody, callback) {
    this.api.updateSelf(JSON.parse('{' + dataBody + '}'))
      .then(body => {
        if (body.error) {
          return callback(new Error(body.error.message));
        }
        callback();
      })
      .catch(err => callback(err));
  });
};

module.exports = apiSteps;
