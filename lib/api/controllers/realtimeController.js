/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  BaseController = require('./baseController'),
  {
    assertHasBody,
    assertBodyHasAttribute,
    assertHasIndexAndCollection
  } = require('../../util/requestAssertions'),
  Bluebird = require('bluebird');

/**
 * @class RealtimeController
 * @param {Kuzzle} kuzzle
 */
class RealtimeController extends BaseController {
  constructor(kuzzle) {
    super(kuzzle, [
      'count',
      'join',
      'list',
      'publish',
      'subscribe',
      'unsubscribe',
      'validate'
    ]);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  subscribe(request) {
    assertHasIndexAndCollection(request);
    assertHasBody(request);

    return this.kuzzle.hotelClerk.addSubscription(request)
      .then(result => {
        this.kuzzle.tokenManager.link(
          request.context.token,
          request.context.connection.id,
          result.roomId);
        return result;
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  join(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    return this.kuzzle.hotelClerk.join(request)
      .then(result => {
        this.kuzzle.tokenManager.link(
          request.context.token,
          request.context.connection.id,
          result.roomId);

        return result;
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<String>}
   */
  unsubscribe(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    return this.kuzzle.hotelClerk.removeSubscription(request)
      .then(roomId => {
        this.kuzzle.tokenManager.unlink(request.context.token, roomId);
        return roomId;
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  count(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    return Bluebird.resolve(this.kuzzle.hotelClerk.countSubscription(request));
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  list(request) {
    return this.kuzzle.hotelClerk.listSubscriptions(request);
  }

  /**
   * Publish a realtime message
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  publish(request) {
    assertHasBody(request);
    assertHasIndexAndCollection(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        newRequest.input.body._kuzzle_info = {
          // Wait for PR #1182 to be merged to have getUserId()
          author: request.context.user._id
            ? String(request.context.user._id)
            : null,
          createdAt: Date.now()
        };

        return this.kuzzle.notifier.publish(newRequest);
      })
      .then(() => ({published: true}));
  }

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  validate(request) {
    return this.kuzzle.funnel.controllers.get('document').validate(request);
  }
}

module.exports = RealtimeController;
