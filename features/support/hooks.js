'use strict';

const
  _ = require('lodash'),
  minimist = require('minimist'),
  {
    After,
    AfterAll,
    Before,
    BeforeAll
  } = require('cucumber'),
  Bluebird = require('bluebird'),
  Http = require('./api/http'),
  World = require('./world');

// before first
BeforeAll(function () {
  const
    fixtures = require('../fixtures/functionalTestsFixtures.json'),
    promises = [],
    world = new World({parameters: parseWorldParameters()}),
    http = new Http(world);

  for (const index of Object.keys(fixtures)) {
    promises.push(() => http.deleteIndex(index)
      .catch(() => true));
  }
  const mappings = { dynamic: 'true', properties: { foo: { type: 'keyword' } } };

  promises.push(() => http.createIndex(world.fakeIndex));
  promises.push(() => http.createCollection(world.fakeIndex, world.fakeCollection, mappings));
  promises.push(() => http.createCollection(world.fakeIndex, world.fakeAltCollection, mappings));

  promises.push(() => http.createIndex(world.fakeAltIndex));
  promises.push(() => http.createCollection(world.fakeAltIndex, world.fakeCollection, mappings));
  promises.push(() => http.createCollection(world.fakeAltIndex, world.fakeAltCollection, mappings));

  return Bluebird.each(promises, promise => promise());
});

// after last
AfterAll(function () {
  const
    promises = [],
    world = new World({parameters: parseWorldParameters()}),
    http = new Http(world);

  for (const index of [
    world.fakeIndex,
    world.fakeAltIndex,
    world.fakeNewIndex,
    'tolkien'
  ]) {
    promises.push(http.deleteIndex(index)
      .catch(() => true));
  }

  return Bluebird.all(promises);
});

Before(function () {
  return this.api.truncateCollection()
    .then(() => this.api.truncateCollection(this.fakeAltIndex));
});

After(function () {
  return this.api.disconnect();
});

After({tags: '@realtime'}, function () {
  return this.api.unsubscribeAll()
    .catch(() => true);
});

Before({tags: '@security'}, function () {
  return cleanSecurity.call(this);
});

Before({tags: '@firstAdmin'}, function () {
  return cleanSecurity.call(this);
});

After({tags: '@firstAdmin'}, function () {
  return grantDefaultRoles.call(this).then(() => cleanSecurity.call(this));
});

Before({tags: '@redis'}, function () {
  return cleanRedis.call(this);
});

After({tags: '@redis'}, function () {
  return cleanRedis.call(this);
});

Before({tags: '@validation'}, function () {
  return cleanValidations.call(this);
});

After({tags: '@validation'}, function () {
  return cleanValidations.call(this);
});

After({tags: '@http'}, function () {
  this.api.encode('identity');
  this.api.decode('identity');
});

function cleanSecurity () {
  if (this.currentUser) {
    delete this.currentUser;
  }

  return this.api.searchUsers({match_all: {}}, {from: 0, size: 999})
    .then(results => {
      const regex = new RegExp('^' + this.idPrefix);
      results = results.result.hits
        .filter(r => r._id.match(regex))
        .map(r => r._id);

      return results.length > 0
        ? this.api.deleteUsers(results, true)
        : Bluebird.resolve();
    })
    .then(() => this.api.searchProfiles({match_all: {}}, {from: 0, size: 999}))
    .then(results => {
      const regex = new RegExp('^' + this.idPrefix);
      results = results.result.hits.filter(r => r._id.match(regex)).map(r => r._id);

      return results.length > 0 ? this.api.deleteProfiles(results, true) : Bluebird.resolve();
    })
    .then(() => this.api.searchRoles({match_all: {}}, {from: 0, size: 999}))
    .then(results => {
      const regex = new RegExp('^' + this.idPrefix);
      results = results.result.hits.filter(r => r._id.match(regex)).map(r => r._id);

      return results.length > 0 ? this.api.deleteRoles(results, true) : Bluebird.resolve();
    });
}

function grantDefaultRoles () {
  return this.api.login('local', this.users.useradmin.credentials.local)
    .then(body => {
      if (body.error) {
        return Promise.reject(new Error(body.error.message));
      }

      if (!body.result) {
        return Promise.reject(new Error('No result provided'));
      }

      if (!body.result.jwt) {
        return Promise.reject(new Error('No token received'));
      }

      if (this.currentUser === null || this.currentUser === undefined) {
        this.currentUser = {};
      }

      this.currentToken = {jwt: body.result.jwt};
      this.currentUser.token = body.result.jwt;

      return this.api.createOrReplaceRole('anonymous', {controllers: {'*': {actions: {'*': true}}}});
    })
    .then(() => this.api.createOrReplaceRole('default', {controllers: {'*': {actions: {'*': true}}}}))
    .then(() => this.api.createOrReplaceRole('admin', {controllers: {'*': {actions: {'*': true}}}}));
}

function cleanRedis() {
  return this.api.callMemoryStorage('keys', { args: { pattern: this.idPrefix + '*' } })
    .then(response => {
      if (_.isArray(response.result) && response.result.length) {
        return this.api.callMemoryStorage('del', { body: { keys: response.result } });
      }

      return null;
    });
}

function cleanValidations() {
  return this.api.searchSpecifications({
    query: {
      match_all: { boost: 1 }
    }
  })
    .then(body => Bluebird.all(body.result.hits
      .filter(r => r._id.match(/^kuzzle-test-/))
      .map(r => this.api.deleteSpecifications(r._id.split('#')[0], r._id.split('#')[1]))
    ));
}

function parseWorldParameters() {
  const
    argv = minimist(process.argv.slice(2)),
    parameters = Object.assign({
      protocol: 'websocket',
      host: 'localhost',
      port: 7512,
      silent: true
    }, JSON.parse(argv['world-parameters'] || '{}'));

  return parameters;
}
