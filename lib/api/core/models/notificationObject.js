/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
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

/**
 * Creates a notification response from a given room, request object, and content.
 *
 * Expected content members:
 *   - scope: [in|out] - sets the notification scope. Default: undefined
 *   - state: [pending|done] - sets the notification state. Default: undefined
 *   - action: overrides the request action
 *   - All other keys will be added to the "result" part of this notification object
 *
 * @class NotificationObject
 * @param {string} roomId - target room identifier
 * @param {Request} request - the request object from which the notification is issued
 * @param {object} [content] - notification content
 */
class NotificationObject {
  constructor(roomId, request, content = {}) {
    this.roomId = roomId;
    this.requestId = request.id;
    this.index = request.input.resource.index;
    this.collection = request.input.resource.collection;
    this.controller = request.input.controller;
    this.action = content.action || request.input.action;
    this.protocol = request.context.protocol;
    this.timestamp = request.timestamp;
    this.metadata = request.input.metadata;
    this.result = {};

    // Handling content
    this.scope = content.scope || undefined;
    this.state = content.state || undefined;

    Object.keys(content)
      .filter(key => ['scope', 'state', 'action'].indexOf(key) === -1)
      .forEach(key => {
        this.result[key] = content[key];
      });
  }

  getUserFlag() {
    if (this.controller === 'realtime') {
      if (this.action === 'subscribe') {
        return 'in';
      }
      else {
        return 'out';
      }
    }

    return 'none';
  }

  toJson() {
    const object = {
      error: null,
      status: 200,
      roomId: this.roomId,
      requestId: this.requestId,
      index: this.index,
      collection: this.collection,
      controller: this.controller,
      action: this.action,
      protocol: this.protocol,
      timestamp: this.timestamp,
      metadata: this.metadata,
      scope: this.scope,
      state: this.state,
      user: this.getUserFlag()
    };

    if (Object.keys(this.result).length > 0) {
      object.result = this.result;
    }

    return object;
  }
}

module.exports = NotificationObject;
