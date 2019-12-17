'use strict';

const
  {
    When
  } = require('cucumber');

const defaultUser = 'nocredentialuser';

When(/^I create ([^ ]+) credentials of user ([a-zA-Z0-9]+) with id ([a-zA-Z0-9-]+)$/, function (strategy, user, id) {
  id = this.idPrefix + id;

  return this.api.createCredentials(strategy, id, this.credentials[user])
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }
    });
});

When(/^I update ([^ ]+) credentials password to "([^"]+)" for user with id ([a-zA-Z0-9-]+)$/, function (strategy, password, id) {
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

When(/^I validate ([^ ]+) credentials of user ([a-zA-Z0-9]+) with id ([a-zA-Z0-9-]+)$/, function (strategy, user, id) {
  id = this.idPrefix + id;

  return this.api.validateCredentials(strategy, id, this.credentials[user])
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }

      if (response.result === false) {
        throw new Error('credentials do not exist');
      }
    });
});

When(/^I delete ([^ ]+) credentials of user with id ([a-zA-Z0-9-]+)$/, function (strategy, id) {
  id = this.idPrefix + id;

  return this.api.deleteCredentials(strategy, id)
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }
    });
});

When(/^I get ([^ ]+) credentials of user ([a-zA-Z0-9]+) with id ([a-zA-Z0-9-]+)$/, function (strategy, user, id) {
  id = this.idPrefix + id;

  return this.api.getCredentials(strategy, id)
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }

      if (response.result.username !== this.credentials[user].username) {
        throw new Error(`username missmatch: got ${response.result.username} instead of ${this.credentials[user].username}`);
      }
    });
});

When(/^I get ([^ ]+) credentials of user ([a-zA-Z0-9]+) by id ([a-zA-Z0-9-]+)$/, function (strategy, user, id) {
  id = this.idPrefix + id;

  return this.api.getCredentialsById(strategy, id)
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }

      if (response.result.username !== this.credentials[user].username) {
        throw new Error(`username missmatch: got ${response.result.username} instead of ${this.credentials[user].username}`);
      }
    });
});

When(/^I check if ([^ ]+) credentials exist for user ([a-zA-Z0-9]+) with id ([a-zA-Z0-9-]+)$/, function (strategy, user, id) {
  id = this.idPrefix + id;

  return this.api.hasCredentials(strategy, id)
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }

      if (response.result === false) {
        throw new Error('credentials do not exist');
      }
    });
});

When(/^I create my ([^ ]+) credentials$/, function (strategy) {
  return this.api.createMyCredentials(strategy, this.credentials[defaultUser])
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }
    });
});

When(/^I update my ([^ ]+) credentials password to "([^"]+)"$/, function (strategy, password) {
  return this.api.updateMyCredentials(strategy, {
    password
  })
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }
    });
});

When(/^I validate my ([^ ]+) credentials$/, function (strategy) {
  return this.api.validateMyCredentials(strategy, this.credentials[defaultUser])
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }
    });
});

When(/^I delete my ([^ ]+) credentials$/, function (strategy) {
  return this.api.deleteMyCredentials(strategy)
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }
    });
});

When(/^I get my ([^ ]+) credentials$/, function (strategy) {
  return this.api.getMyCredentials(strategy)
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }

      if (response.result.username !== this.credentials[defaultUser].username) {
        throw new Error(`username mismatch: got ${response.result.username} instead of ${this.credentials[defaultUser].username}`);
      }
    });
});

When(/^I check if i have( no)? ([^ ]+) credentials$/, function (noCredentials, strategy) {
  return this.api.credentialsExist(strategy, this.credentials[defaultUser])
    .then(response => {
      if (response.error !== null) {
        throw new Error(response.error.message);
      }

      if (response.result === true && noCredentials) {
        throw new Error('should have no credential but has');
      }
      if (response.result === false && !noCredentials) {
        throw new Error('should have credential but has not');
      }
    });
});

