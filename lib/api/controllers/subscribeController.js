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
    return kuzzle.hotelClerk.addSubscription(requestObject, userContext)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.join = function subscribeJoin (requestObject, userContext) {
    return kuzzle.hotelClerk.join(requestObject, userContext)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.off = function subscribeOff (requestObject, userContext) {
    return kuzzle.hotelClerk.removeSubscription(requestObject, userContext)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.count = function subscribeCount (requestObject, userContext) {
    return kuzzle.hotelClerk.countSubscription(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.list = function subscribeList (requestObject, userContext) {
    return kuzzle.hotelClerk.listSubscriptions(userContext)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };
}

module.exports = SubscribeController;
