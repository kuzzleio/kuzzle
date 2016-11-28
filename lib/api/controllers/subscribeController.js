var
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function SubscribeController (kuzzle) {

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.on = function subscribeOn (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeOn', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.hotelClerk.addSubscription(modifiedData.requestObject, modifiedData.userContext);
      })
      .then(response => kuzzle.pluginsManager.trigger('subscription:afterOn', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.join = function subscribeJoin (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeJoin', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.hotelClerk.join(modifiedData.requestObject, modifiedData.userContext);
      })
      .then(response => kuzzle.pluginsManager.trigger('subscription:afterJoin', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.off = function subscribeOff (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeOff', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.hotelClerk.removeSubscription(modifiedData.requestObject, modifiedData.userContext);
      })
      .then(response => kuzzle.pluginsManager.trigger('subscription:afterOff', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.count = function subscribeCount (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeCount', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.hotelClerk.countSubscription(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('subscription:afterCount', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.list = function subscribeList (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeList', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.hotelClerk.listSubscriptions(modifiedData.userContext);
      })
      .then(response => kuzzle.pluginsManager.trigger('subscription:afterList', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };
}

module.exports = SubscribeController;
