'use strict';

const defaultUser = 'nocredentialuser';

module.exports = function () {
  this.When(/^I create ([^ ]+) credentials of user ([a-zA-Z0-9]+)$/, function (strategy, user) {
    this.api.createCredentials(strategy, user, this.credentials[user])
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I update ([^ ]+) credentials password to "[^"]+" for user ([a-zA-Z0-9]+)$/, function (strategy, password, user) {
    this.api.updateCredentials(strategy, user, {
      password
    })
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I validate ([^ ]+) credentials of user ([a-zA-Z0-9]+)$/, function (strategy, user) {
    this.api.validateCredentials(strategy, user, this.credentials[user])
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I delete ([^ ]+) credentials of user ([a-zA-Z0-9]+)$/, function (strategy, user) {
    this.api.deleteCredentials(strategy, user)
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I get ([^ ]+) credential information of user ([a-zA-Z0-9]+)$/, function (strategy, user) {
    this.api.getCredentials(strategy, user)
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I check if ([^ ]+) credentials exist for user ([a-zA-Z0-9]+)$/, function (strategy, user) {
    this.api.hasCredentials(strategy, user, this.credentials[user])
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I create ([^ ]+) credentials of current user$/, function (strategy) {
    this.api.createMyCredentials(strategy, this.credentials[defaultUser])
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I update ([^ ]+) credentials password to "[^"]+" for current user$/, function (strategy, password) {
    this.api.updateMyCredentials(strategy, {
      password
    })
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I validate ([^ ]+) credentials of current user ([a-zA-Z0-9]+)$/, function (strategy) {
    this.api.validateMyCredentials(strategy, this.credentials[defaultUser])
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I delete ([^ ]+) credentials of current user$/, function (strategy) {
    this.api.deleteMyCredentials(strategy)
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I get ([^ ]+) credential information of current user$/, function (strategy) {
    this.api.getMyCredentials(strategy, defaultUser)
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I check if ([^ ]+) credentials exist for current user ([a-zA-Z0-9]+)$/, function (strategy, user) {
    this.api.hasMyCredentials(strategy, this.credentials[user])
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });
};