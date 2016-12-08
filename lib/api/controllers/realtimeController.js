'use strict';

var
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertHasBodyHasAttribute = require('./util/requestAssertions').assertHasBodyHasAttribute,
  assertHasIndexAndCollection = require('./util/requestAssertions').assertHasIndexAndCollection,
  assertHasId = require('./util/requestAssertions').assertHasId();

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function RealtimeController (kuzzle) {
  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.on = function realtimeOn (request) {
    assertHasIndexAndCollection(request, 'realtime:on');
    assertHasBody(request, 'realtime:on');

    return kuzzle.hotelClerk.addSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.join = function realtimeJoin (request) {
    assertHasBody(request, 'realtime:join');
    assertHasBodyHasAttribute(request, 'roomId', 'realtime:join');

    return kuzzle.hotelClerk.join(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.off = function realtimeOff (request) {
    assertHasBody(request, 'realtime:off');
    assertHasBodyHasAttribute(request, 'roomId', 'realtime:off');

    return kuzzle.hotelClerk.removeSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.count = function realtimeCount (request) {
    assertHasBody(request, 'realtime:count');
    assertHasBodyHasAttribute(request, 'roomId', 'realtime:count');

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

    assertHasBody(request, 'realtime:publish');
    assertHasIndexAndCollection(request, 'realtime:publish');

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
    assertHasBody(request, 'realtime:validate');
    assertHasIndexAndCollection(request, 'realtime:validate');
    assertHasId(request, 'realtime:validate');

    return kuzzle.validation.validationPromise(request, true)
      .then(response => {
        if (!response.valid) {
          kuzzle.pluginsManager.trigger('validation:error', `The document does not comply with the ${request.input.resource.index} / ${request.input.resource.collection} : ${JSON.stringify(request.input.body)}`);
        }

        return Promise.resolve(response);
      });
  };
}

module.exports = RealtimeController;