/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const { NativeController } = require('./base');
const {
  assertHasBody,
  assertBodyHasAttribute,
  assertHasIndexAndCollection
} = require('../../util/requestAssertions');

/**
 * @class RealtimeController
 * @param {Kuzzle} kuzzle
 */
class RealtimeController extends NativeController {
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
  async subscribe (request) {
    assertHasIndexAndCollection(request);
    assertHasBody(request);

    if (request.input.args.cluster === undefined) {
      request.input.args.cluster = true;
    }
    else {
      request.input.args.cluster = this.getBoolean(request, 'cluster');
    }

    const result = await this.kuzzle.hotelClerk.addSubscription(request);

    if (! result) {
      // can occur if the connection is dead.
      // If so, we don't really have to care about the response
      return null;
    }

    this.kuzzle.tokenManager.link(
      request.context.token,
      request.context.connection.id,
      result.roomId);

    return result;
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async join (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    const result = await this.kuzzle.hotelClerk.join(request);

    this.kuzzle.tokenManager.link(
      request.context.token,
      request.context.connection.id,
      result.roomId);

    return result;
  }

  /**
   * @param {Request} request
   * @returns {Promise<String>}
   */
  async unsubscribe (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    const roomId = await this.kuzzle.hotelClerk.removeSubscription(request);

    this.kuzzle.tokenManager.unlink(request.context.token, roomId);

    return roomId;
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async count (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    return this.kuzzle.hotelClerk.countSubscription(request);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  list (request) {
    return this.kuzzle.hotelClerk.listSubscriptions(request);
  }

  /**
   * Publish a realtime message
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async publish (request) {
    assertHasBody(request);
    assertHasIndexAndCollection(request);

    const newRequest = await this.kuzzle.validation.validate(request, false);

    newRequest.input.body._kuzzle_info = {
      author: this.getUserId(request),
      createdAt: Date.now()
    };

    await this.kuzzle.notifier.publish(newRequest);

    return { published: true };
  }

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  validate (request) {
    return this.kuzzle.funnel.controllers.get('document').validate(request);
  }
}

module.exports = RealtimeController;
