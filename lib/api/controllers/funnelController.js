var
  q = require('q'),
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
   * @param {RequestObject} requestObject
   * @param {Object} connection
   * depending on who call execute (websocket or http)
   */
  this.execute = function (requestObject, context) {
    var
      deferred = q.defer();

    kuzzle.statistics.startRequest(requestObject);

    requestObject.checkInformation()
      .then(function () {
        var
          err;

        // Test if a controller and an action exist for the object
        if (!this[requestObject.controller] || !this[requestObject.controller][requestObject.action] ||
          typeof this[requestObject.controller][requestObject.action] !== 'function') {
          err = new Error('No corresponding action ' + requestObject.action + ' in controller ' + requestObject.controller);
          err.status = 404;
          deferred.reject(err);
          return false;
        }

        // check if the current user is allowed to process
        if (context.user.profile.isActionAllowed(requestObject, context) === false) {
          err = new Error('Unauthorized action');
          err.status = 401;
          deferred.reject(err);
          return false;
        }

        return this[requestObject.controller][requestObject.action](requestObject, context);
      }.bind(this))
      .then(function (responseObject) {
        kuzzle.statistics.completedRequest(requestObject);
        deferred.resolve(responseObject);
      })
      .catch(function (error) {
        kuzzle.statistics.failedRequest(requestObject);
        deferred.reject(error);
      });

    return deferred.promise;
  };

};
