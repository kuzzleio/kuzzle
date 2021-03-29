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

/**
 * User notification document
 *
 * @class UserNotification
 */
class UserNotification {
  constructor(opts) {
    this.type = 'user';

    this.status = opts.status;
    this.user = opts.user;
    this.result = opts.result;
    this.node = opts.node;
    this.timestamp = opts.timestamp;
    this.volatile = opts.volatile;
    this.index = opts.index;
    this.collection = opts.collection;
    this.controller = opts.controller;
    this.action = opts.action;
    this.protocol = opts.protocol;
  }

  /**
   * Instantiates a UserNotification object from a KuzzleRequest
   * @param {Request} request - the request object from which the notification is issued
   * @param {string} user - The scope of the notification (in or out)
   * @param {object} content - Notification content
   * returns {UserNotification}
   */
  static fromRequest (request, user, result) {
    return new UserNotification({
      action: request.input.action,
      collection: request.input.resource.collection,
      controller: request.input.controller,
      index: request.input.resource.index,
      node: global.kuzzle.id,
      protocol: request.context.connection.protocol,
      result,
      status: 200,
      timestamp: request.timestamp,
      user,
      volatile: request.input.volatile,
    });
  }
}

module.exports = UserNotification;
