var
  async = require('async'),
  q = require('q');

var myHooks = function () {
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
  this.Before('@usingREST', function (callback) {
    setAPI(this, 'REST')
      .then(function (api) {
        this.api = api;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.Before('@usingWebsocket', function (callback) {
    setAPI(this, 'Websocket')
      .then(function (api) {
        this.api = api;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.Before('@usingMQTT', function (callback) {
    setAPI(this, 'MQTT')
      .then(function (api) {
        this.api = api;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.Before('@usingAMQP', function (callback) {
    setAPI(this, 'AMQP')
      .then(function (api) {
        this.api = api;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.Before('@usingSTOMP', function (callback) {
    setAPI(this, 'STOMP')
      .then(function (api) {
        this.api = api;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.After(function (callback) {
    this.api.deleteByQuery({})
      .then(function () {
        this.api.disconnect();
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.After('@removeSchema', function (callback) {
    this.api.deleteCollection()
      .then(function () {
        setTimeout(callback, 1000);
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.After('@unsubscribe', function (callback) {
    async.each(Object.keys(this.api.subscribedRooms), function (room, callbackAsync) {
      this.api.unsubscribe(room)
        .then(function () {
          callbackAsync();
        }.bind(this))
        .catch(function (error) {
          callbackAsync(error);
        });
    }.bind(this),
    function (error) {
      this.api.subscribedRooms = [];

      if (error) {
        callback(error);
      }

      callback();
    }.bind(this));
  });
};

module.exports = myHooks;

var setAPI = function (world, apiName) {
  var
    deferred = q.defer(),
    api = require('./api' + apiName);

  api.init(world);

  /*
   Ensure that every scenario runs on a clean database, just in case something went wrong in a previous run, for
   instance if tests where interrupted after writing documents, changing a schema, and so on.
   */
  api.deleteByQuery({})
    .then(function () {
      deferred.resolve(api);
    })
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};
