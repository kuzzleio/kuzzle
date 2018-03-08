'use strict';

const
  _ = require('lodash'),
  {
    After,
    Before
  } = require('cucumber'),
  Bluebird = require('bluebird');

// before first
Before({tags: '@first'}, function () {
  const
    fixtures = require('../fixtures/functionalTestsFixtures.json'),
    promises = [];

  for (const index of Object.keys(fixtures)) {
    promises.push(() => this.api.deleteIndex(index)
      .catch(() => true));
  }

  promises.push(() => this.api.createIndex(this.api.world.fakeIndex));
  promises.push(() => this.api.createCollection(this.api.world.fakeIndex, this.api.world.fakeCollection));
  promises.push(() => this.api.createCollection(this.api.world.fakeIndex, this.api.world.fakeAltCollection));

  promises.push(() => this.api.createIndex(this.api.world.fakeAltIndex));
  promises.push(() => this.api.createCollection(this.api.world.fakeAltIndex, this.api.world.fakeCollection));
  promises.push(() => this.api.createCollection(this.api.world.fakeAltIndex, this.api.world.fakeAltCollection));

  return Bluebird.each(promises, promise => promise());
});

// after last
After({tags: '@latest'}, function () {
  const
    promises = [];

  for (const index of [
    this.fakeIndex,
    this.fakeAltIndex,
    this.fakeNewIndex
  ]) {
    promises.push(this.api.deleteIndex(index)
      .catch(() => true));
    promises.push(this.api.setAutoRefresh(index, false));
  }

  return Bluebird.all(promises);
});

After(function () {
  return this.api.truncateCollection()
    .then(() => this.api.refreshIndex(this.fakeIndex))
    .then(() => this.api.disconnect())
    .then(() => true)
    .catch(() => true);
});

After({tags: '@realtime'}, function () {
  return this.api.unsubscribeAll()
    .catch(() => true);
});

Before({tags: '@security'}, function () {
  return cleanSecurity.call(this);
});

After({tags: '@security'}, function () {
  return cleanSecurity.call(this);
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


function cleanSecurity () {
  if (this.currentUser) {
    delete this.currentUser;
  }

  return this.api.refreshInternalIndex()
    .then(() => this.api.searchUsers({match_all: {}}, {from: 0, size: 999}))
    .then(results => {
      const regex = new RegExp('^' + this.idPrefix);
      results = results.result.hits
        .filter(r => r._id.match(regex))
        .map(r => r._id);

      return results.length > 0 ? this.api.deleteUsers(results, true) : Bluebird.resolve();
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


