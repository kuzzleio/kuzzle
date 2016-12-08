'use strict';

var
  assertBody = require('./util/requestAssertions').assertBody,
  assertBodyAttribute = require('./util/requestAssertions').assertBodyAttribute,
  assertIndexAndCollection = require('./util/requestAssertions').assertIndexAndCollection,
  assertId = require('./util/requestAssertions').assertId();

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
    assertIndexAndCollection(request, 'realtime:on');
    assertBody(request, 'realtime:on');

    return kuzzle.hotelClerk.addSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.join = function realtimeJoin (request) {
    assertBody(request, 'realtime:join');
    assertBodyAttribute(request, 'roomId', 'realtime:join');

    return kuzzle.hotelClerk.join(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.off = function realtimeOff (request) {
    assertBody(request, 'realtime:off');
    assertBodyAttribute(request, 'roomId', 'realtime:off');

    return kuzzle.hotelClerk.removeSubscription(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.count = function realtimeCount (request) {
    assertBody(request, 'realtime:count');
    assertBodyAttribute(request, 'roomId', 'realtime:count');

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

    assertBody(request, 'realtime:publish');
    assertIndexAndCollection(request, 'realtime:publish');

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
    assertBody(request, 'realtime:validate');
    assertIndexAndCollection(request, 'realtime:validate');
    assertId(request, 'realtime:validate');

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