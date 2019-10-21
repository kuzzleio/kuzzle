'use strict';

const
  _ = require('lodash'),
  minimist = require('minimist'),
  {
    After,
    Before,
    BeforeAll
  } = require('cucumber'),
  Bluebird = require('bluebird'),
  Http = require('./api/http'),
  World = require('./world');

function bootstrapDatabase () {
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
}

function cleanDatabase () {
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
}

// before first
BeforeAll(function () {
  return cleanDatabase()
    .then(() => bootstrapDatabase());
});

Before(function () {
  const world = new World({parameters: parseWorldParameters()});

  return this.api.truncateCollection(world.fakeIndex, world.fakeCollection)
    .catch(() => {})
    .then(() => this.api.truncateCollection(world.fakeAltIndex, world.fakeAltCollection))
    .catch(() => {})
    .then(() => this.api.resetSecurity());
});

Before({ tags: '@resetDatabase' }, async function () {
  await cleanDatabase();
  await bootstrapDatabase();
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
  return grantDefaultRoles.call(this).then(() => );
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

  return this.api.resetSecurity();
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
