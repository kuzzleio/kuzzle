var
  socket = require('socket.io'),
  async = require('async'),
  q = require('q'),
  _ = require('lodash'),
  WriteController = require('./writeController'),
  ReadController = require('./readController'),
  SubscribeController = require('./subscribeController'),
  BulkController = require('./bulkController'),
  AdminController = require('./adminController');

module.exports = function FunnelController (kuzzle) {

  this.write = null;
  this.subscribe = null;
  this.read = null;
  this.admin = null;
  this.bulk = null;

  this.init = function () {
    this.write = new WriteController(kuzzle);
    this.read = new ReadController(kuzzle);
    this.subscribe = new SubscribeController(kuzzle);
    this.bulk = new BulkController(kuzzle);
    this.admin = new AdminController(kuzzle);
  };

  /**
   * Execute in parallel all tests for check whether the object is well constructed
   * Then generate a requestId if not provided and execute the right controller/action
   *
   * @param {Object} object
   * @param {Object} connection
   * depending on who call execute (websocket or http)
   */
  this.execute = function (object, connection) {
    var deferred = q.defer();

    async.parallel([
        // Test if the controller is well defined
        function (callback) {
          if (!object.controller) {
            kuzzle.log.error('No controller provided for object', object);
            callback('No controller provided for object');

            return false;
          }

          callback(false);
        }.bind(this),

        // Test if the action is well defined
        function (callback) {
          if (!object.action) {
            kuzzle.log.error('No action provided for object', object);
            callback('No action provided for object');

            return false;
          }

          callback(null);
        }.bind(this),

        // Test if a controller and an action exist for the object
        function (callback) {
          if (!this[object.controller] || !this[object.controller][object.action] ||
              typeof this[object.controller][object.action] !== 'function') {
            kuzzle.log.error('No corresponding action', object.action, 'in controller', object.controller);
            callback('No corresponding action and/or controller');

            return false;
          }

          callback(null);
        }.bind(this)
      ],
      function onTestError (err) {
        if (err) {
          deferred.reject(err);
          return false;
        }

        this[object.controller][object.action](object, connection)
          .then(function (result) {
            deferred.resolve(result);
          })
          .catch(function (error) {
            deferred.reject(error);
          });
      }.bind(this));

    return deferred.promise;
  };

};