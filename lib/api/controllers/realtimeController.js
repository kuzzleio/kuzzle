/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
class RealtimeController {
  constructor(kuzzle) {
    /** @type Kuzzle */
    this.kuzzle = kuzzle;
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  subscribe(request) {
    assertHasIndexAndCollection(request);
    assertHasBody(request);

    return this.kuzzle.hotelClerk.addSubscription(request);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  join(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    return Bluebird.resolve(this.kuzzle.hotelClerk.join(request));
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  unsubscribe(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'roomId');

    return Bluebird.resolve(this.kuzzle.hotelClerk.removeSubscription(request));
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

    return this.kuzzle.validation.validationPromise(request, false)
      .then(newRequest => this.kuzzle.notifier.publish(newRequest, 'in', 'done'));
  }

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  validate(request) {
    return this.kuzzle.funnel.controllers.document.validate(request);
  }
}

module.exports = RealtimeController;
