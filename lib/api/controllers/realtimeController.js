'use strict';

var
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertBodyHasAttribute = require('./util/requestAssertions').assertBodyHasAttribute,
  assertHasIndexAndCollection = require('./util/requestAssertions').assertHasIndexAndCollection;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function RealtimeController (kuzzle) {
  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.subscribe = function realtimeSubscribe (request) {
    assertHasIndexAndCollection(request);
    assertHasBody(request);

    return kuzzle.hotelClerk.addSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.join = function realtimeJoin (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    return kuzzle.hotelClerk.join(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.unsubscribe = function realtimeUnsubscribe (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    return kuzzle.hotelClerk.removeSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.count = function realtimeCount (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    return kuzzle.hotelClerk.countSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.list = function realtimeList (request) {
    return kuzzle.hotelClerk.listSubscriptions(request);
  };

  /**
   * Publish a realtime message
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.publish = function realtimePublish (request) {

    assertHasBody(request);
    assertHasIndexAndCollection(request);

    return kuzzle.validation.validationPromise(request, false)
      .then(newRequest => kuzzle.notifier.publish(newRequest));
  };

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.validate = function realtimeValidate (request) {
    return kuzzle.funnel.controllers.document.validate(request);
  };
}

module.exports = RealtimeController;