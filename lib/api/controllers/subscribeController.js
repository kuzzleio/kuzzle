'use strict';

var {assertBody, assertBodyAttribute, assertIndexAndCollection} = require('./util/requestAssertions');

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
    assertIndexAndCollection(request, 'on');
    assertBody(request, 'on');

    return kuzzle.hotelClerk.addSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.join = function subscribeJoin (request) {
    assertBody(request, 'join');
    assertBodyAttribute(request, 'roomId', 'join');

    return kuzzle.hotelClerk.join(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.off = function subscribeOff (request) {
    assertBody(request, 'off');
    assertBodyAttribute(request, 'roomId', 'off');

    return kuzzle.hotelClerk.removeSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.count = function subscribeCount (request) {
    assertBody(request, 'count');
    assertBodyAttribute(request, 'roomId', 'count');

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
