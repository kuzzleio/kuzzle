'use strict';

const
  _ = require('lodash'),
  async = require('async'),
  Promise = require('bluebird'),
  requestErrors = require('request-promise/errors');

const myHooks = function () {
  this.registerHandler('BeforeFeature', (event, callback) => {
    const
      api = restApi(),
      fixtures = require('../fixtures/functionalTestsFixtures.json'),
      promises = [];

    Object.keys(fixtures).forEach(index => {
      promises.push(() => new Promise(resolve => {
        api.deleteIndex(index)
          .then(response => resolve(response))
          // ignoring errors
          .catch(() => resolve({}));
      }));

      promises.push(() => api.createIndex(index));
      promises.push(() => api.refreshIndex(index));
    });

    Promise.each(promises, promise => promise()).asCallback(callback);
  });

  this.registerHandler('AfterFeature', (event, callback) => {
    const
      api = restApi(),
      promises = [];

    // give a little time to run the After hook before proceeding
    setTimeout(() => {
      [api.world.fakeIndex, api.world.fakeAltIndex, api.world.fakeNewIndex].forEach(index => {
        promises.push(api.deleteIndex(index)
          .catch(error => {
            // Ignore 404 errors
            if (error instanceof requestErrors.StatusCodeError && error.statusCode === 404) {
              return Promise.resolve();
            }

            return Promise.reject(new Error(error));
          }));
        promises.push(api.setAutoRefresh(index, false));
      });

      Promise.all(promises)
        .then(() => callback())
        .catch(error => {
          callback(error);
        });
    }, 0);
  });

  /**
   *  API LOADING AND RELEASING
   *  Until cucumber.js supports BeforeAll and AfterAll tags, we have to open/close connections
   *  on each test case.
   *
   *  We could also load all the tested API at the beginning of each test case, using reentrant init() functions,
   *  and close them all at the very end using the AfterFeatures event.
   *  This method involves a cucumber.js hack, where we save a 'world' reference at the end of each test case so that
   *  we can use it when the AfterFeatures event is emitted.
   *
   *  Problem is, there is no guarantee that the world we saved still exists when this event is sent. In fact, the
   *  Cucumber.js documentation states that it should be destroyed at this point of time.
   *
   *  And we don't want to deal with destroyed worlds, this is all too messy. And dangerous.
   */
  this.Before({tags: ['@usingHttp']}, function (scenario, callback) {
    this.api = setAPI(this, 'Http');
    callback();
  });

  this.Before({tags: ['@usingWebsocket']}, function (scenario, callback) {
    this.api = setAPI(this, 'Websocket');
    callback();
  });

  this.After(function (scenario, callback) {
    this.api.truncateCollection()
      .then(() => this.api.refreshIndex(this.fakeIndex))
      .then(() => this.api.disconnect())
      .then(() => callback())
      .catch(() => callback());
  });

  this.After({tags: ['@unsubscribe']}, function (scenario, callback) {
    async.each(Object.keys(this.api.subscribedRooms), (socketName, callbackSocketName) => {
      async.each(Object.keys(this.api.subscribedRooms[socketName]), (room, callbackRoom) => {
        this.api.unsubscribe(room, socketName)
          .then(() => callbackRoom())
          .catch(error => callbackRoom(error));
      }, error => {
        this.api.subscribedRooms[socketName] = {};

        callbackSocketName(error);
      });
    }, error => callback(error));
  });

  this.Before({tags: ['@cleanSecurity']}, function (scenario, callback) {
    cleanSecurity.call(this, callback);
  });

  this.After({tags: ['@cleanSecurity']}, function (scenario, callback) {
    cleanSecurity.call(this, callback);
  });

  this.Before({tags: ['@cleanRedis']}, function (scenario, callback) {
    cleanRedis.call(this, callback);
  });

  this.After({tags: ['@cleanRedis']}, function (scenario, callback) {
    cleanRedis.call(this, callback);
  });

  this.Before({tags: ['@cleanValidations']}, function (scenario, callback) {
    cleanValidations.call(this, callback);
  });

  this.After({tags: ['@cleanValidations']}, function (scenario, callback) {
    cleanValidations.call(this, callback);
  });

};

module.exports = myHooks;

function setAPI (world, apiName) {
  const
    Api = require('./api' + apiName),
    api = new Api();

  api.init(world);

  return api;
}

function restApi () {
  const
    W = require('./world'),
    world = new (new W()).World();

  return setAPI(world, 'Http');

}

function cleanSecurity (callback) {
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

      return results.length > 0 ? this.api.deleteUsers(results, true) : Promise.resolve();
    })
    .then(() => this.api.searchProfiles({match_all: {}}, {from: 0, size: 999}))
    .then(results => {
      const regex = new RegExp('^' + this.idPrefix);
      results = results.result.hits.filter(r => r._id.match(regex)).map(r => r._id);

      return results.length > 0 ? this.api.deleteProfiles(results, true) : Promise.resolve();
    })
    .then(() => this.api.searchRoles({match_all: {}}, {from: 0, size: 999}))
    .then(results => {
      const regex = new RegExp('^' + this.idPrefix);
      results = results.result.hits.filter(r => r._id.match(regex)).map(r => r._id);

      return results.length > 0 ? this.api.deleteRoles(results, true) : Promise.resolve();
    })
    .then(() => callback(null))
    .catch(callback);
}

function cleanRedis(callback) {
  this.api.callMemoryStorage('keys', { args: { pattern: this.idPrefix + '*' } })
    .then(response => {
      if (_.isArray(response.result) && response.result.length) {
        return this.api.callMemoryStorage('del', { body: { keys: response.result } });
      }

      return null;
    })
    .then(response => callback(null, response))
    .catch(callback);
}

function cleanValidations(callback) {
  this.api.searchSpecifications({
    query: {
      match_all: { boost: 1 }
    }
  })
    .then(body => Promise.all(body.result.hits
      .filter(r => r._id.match(/^kuzzle-test-/))
      .map(r => this.api.deleteSpecifications(r._id.split('#')[0], r._id.split('#')[1]))
    ))
    .then(response => callback(null, response))
    .catch(callback);
}


