/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function SubscribeController (kuzzle) {

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.on = function subscribeOn (request) {
    return kuzzle.hotelClerk.addSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.join = function subscribeJoin (request) {
    return kuzzle.hotelClerk.join(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.off = function subscribeOff (request) {
    return kuzzle.hotelClerk.removeSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.count = function subscribeCount (request) {
    return kuzzle.hotelClerk.countSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.list = function subscribeList (request) {
    return kuzzle.hotelClerk.listSubscriptions(request);
  };
}

module.exports = SubscribeController;
