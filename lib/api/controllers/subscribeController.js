'use strict';

var
  assertHadBody = require('./util/requestAssertions').assertHadBody,
  assertBodyHasAttribute = require('./util/requestAssertions').assertBodyHasAttribute,
  assertHasIndexAndCollection = require('./util/requestAssertions').assertHasIndexAndCollection;

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
    assertHasIndexAndCollection(request, 'on');
    assertHadBody(request, 'on');

    return kuzzle.hotelClerk.addSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.join = function subscribeJoin (request) {
    assertHadBody(request, 'join');
    assertBodyHasAttribute(request, 'roomId', 'join');

    return kuzzle.hotelClerk.join(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.off = function subscribeOff (request) {
    assertHadBody(request, 'off');
    assertBodyHasAttribute(request, 'roomId', 'off');

    return kuzzle.hotelClerk.removeSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.count = function subscribeCount (request) {
    assertHadBody(request, 'count');
    assertBodyHasAttribute(request, 'roomId', 'count');

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
