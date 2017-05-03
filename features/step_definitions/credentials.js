'use strict';

const defaultUser = 'nocredentialuser';

module.exports = function () {
  this.When(/^I create ([^ ]+) credentials of user ([a-zA-Z0-9]+) with id ([a-zA-Z0-9-]+)$/, function (strategy, user, id) {
    id = this.idPrefix + id;

    return this.api.createCredentials(strategy, id, this.credentials[user])
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I update ([^ ]+) credentials password to "([^"]+)" for user with id ([a-zA-Z0-9-]+)$/, function (strategy, password, id) {
    id = this.idPrefix + id;

    return this.api.updateCredentials(strategy, id, {
      password
    })
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I validate ([^ ]+) credentials of user ([a-zA-Z0-9]+) with id ([a-zA-Z0-9-]+)$/, function (strategy, user, id) {
    id = this.idPrefix + id;

    return this.api.validateCredentials(strategy, id, this.credentials[user])
      .then(response => {
        if (response.result === false) {
          throw new Error('credentials do not exist');
        }

        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I delete ([^ ]+) credentials of user with id ([a-zA-Z0-9-]+)$/, function (strategy, id) {
    id = this.idPrefix + id;

    return this.api.deleteCredentials(strategy, id)
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I get ([^ ]+) credential information of user with id ([a-zA-Z0-9-]+)$/, function (strategy, id) {
    id = this.idPrefix + id;

    return this.api.getCredentials(strategy, id)
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I check if ([^ ]+) credentials exist for user ([a-zA-Z0-9]+) with id ([a-zA-Z0-9-]+)$/, function (strategy, user, id) {
    id = this.idPrefix + id;

    return this.api.hasCredentials(strategy, id, this.credentials[user])
      .then(response => {
        if (response.result === false) {
          throw new Error('credentials do not exist');
        }

        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I create ([^ ]+) credentials of current user$/, function (strategy) {
    return this.api.createMyCredentials(strategy, this.credentials[defaultUser])
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I update ([^ ]+) credentials password to "[^"]+" for current user$/, function (strategy, password) {
    return this.api.updateMyCredentials(strategy, {
      password
    })
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I validate ([^ ]+) credentials of current user ([a-zA-Z0-9]+)$/, function (strategy) {
    return this.api.validateMyCredentials(strategy, this.credentials[defaultUser])
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I delete ([^ ]+) credentials of current user$/, function (strategy) {
    return this.api.deleteMyCredentials(strategy)
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I get ([^ ]+) credential information of current user$/, function (strategy) {
    return this.api.getMyCredentials(strategy, defaultUser)
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });

  this.When(/^I check if ([^ ]+) credentials exist for current user ([a-zA-Z0-9]+)$/, function (strategy, user) {
    return this.api.hasMyCredentials(strategy, this.credentials[user])
      .then(response => {
        if (response.error !== null) {
          throw new Error(response.error.message);
        }
      });
  });
};