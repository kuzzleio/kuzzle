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
        promises.push(api.deleteIndex(index));
        promises.push(api.setAutoRefresh(index, false));
      });

      Promise.all(promises)
        .then(() => callback())
        .catch(error => {
          // Ignore 404 errors
          if (error instanceof requestErrors.StatusCodeError && error.statusCode === 404) {
            return callback();
          }

          callback(new Error(error));
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
  var
    Api = require('./api' + apiName),
    api = new Api();

  api.init(world);

  return api;
}

function restApi () {
  var
    W = require('./world'),
    world = new (new W()).World();

  return setAPI(world, 'Http');

}

function cleanSecurity (callback) {
  if (this.currentUser) {
    delete this.currentUser;
  }

  this.api.listIndexes()
    .then(() => {
      return this.api.searchUsers({
        query: {
          match_all: {
            boost: 1
          }
        },
        from: 0,
        size: 9999
      });
    })
    .then(results => {
      var
        promises = [],
        regex = new RegExp('^' + this.idPrefix);

      results = results.result.hits.filter(r => r._id.match(regex)).map(r => r._id);

      results.forEach(id => {
        promises.push(this.api.deleteUser(id));
      });

      return Promise.all(promises)
        .catch(() => {
          // discard errors
          return Promise.resolve();
        });
    })
    .then(() => {
      return this.api.searchProfiles({
        from: 0,
        size: 9999
      });
    })
    .then(results => {
      var
        promises = [],
        regex = new RegExp('^' + this.idPrefix);

      results = results.result.hits.filter(r => r._id.match(regex)).map(r => r._id);

      results.forEach(id => {
        promises.push(this.api.deleteProfile(id));
      });

      return Promise.all(promises)
        .catch(() => {
          // discard errors
          return Promise.resolve();
        });
    })
    .then(() => {
      return this.api.searchRoles();
    })
    .then(results => {
      var
        promises = [],
        regex = new RegExp('^' + this.idPrefix);

      results = results.result.hits.filter(r => r._id.match(regex)).map(r => r._id);

      results.forEach(id => {
        promises.push(this.api.deleteRole(id));
      });

      return Promise.all(promises)
        .catch(() => {
          // discard errors
          return Promise.resolve();
        });
    })
    .then(() => {
      callback();
    })
    .catch(error => {
      callback(error.message ? error.message : error);
    });
}

function cleanRedis(callback) {
  this.api.callMemoryStorage('keys', { args: { pattern: this.idPrefix + '*' } })
    .then(response => {
      if (_.isArray(response.result) && response.result.length) {
        return this.api.callMemoryStorage('del', { body: { keys: response.result } });
      }

      return null;
    })
    .then(() => {
      callback();
    })
    .catch(error => callback(error));
}

function cleanValidations(callback) {
  this.api.listIndexes()
    .then(() => {
      return this.api.searchSpecifications({
        query: {
          match_all: {
            boost: 1
          }
        }
      });
    })
    .then(body => {
      var
        promises = [],
        regex = new RegExp('^kuzzle-test-');

      body.result.hits
        .filter(r => r._id.match(regex)).map(r => r._id)
        .forEach(id => {
          promises.push(this.api.deleteSpecifications(id.split('#')[0], id.split('#')[1]));
        });

      return Promise.all(promises)
        .catch(() => {
          // discard errors
          return Promise.resolve();
        });
    })
    .then(() => {
      callback();
    })
    .catch(error => callback(error));
}


