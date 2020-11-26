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
 * Creates a notification response from a given room, request object, and content.
 *
 * @class DocumentNotification
 * @param {Request|null} request - the request object from which the notification is issued
 * @param {string} scope - The scope of the notification (in or out)
 * @param {state} state - The document state (pending or done)
 * @param {action} action - Action performed on the document
 * @param {object} content - Notification content
 */
class DocumentNotification {
  constructor(request, scope, action, content) {
    this.status = 200;
    this.action = action;
    this.scope = scope;
    this.result = content;
    this.type = 'document';

    if (request) {
      this.requestId = request.id;
      this.timestamp = request.timestamp;
      this.volatile = request.input.volatile;
      this.index = request.input.resource.index;
      this.collection = request.input.resource.collection;
      this.controller = request.input.controller;
      this.protocol = request.context.connection.protocol;
    }
  }

  /**
   * Serializes this object for transport
   *
   * @return {string}
   */
  serialize () {
    return JSON.stringify(this);
  }

  /**
   * Unserialize the provided argument (obtained with "serialize") and returns
   * an appropriately instantiated DocumentNotification
   *
   * @param  {string} str - Serialized DocumentNotification object
   * @return {DocumentNotification}
   */
  static unserialize (str) {
    const obj = JSON.parse(str);
    const notification = new DocumentNotification(null);

    return Object.assign(notification, obj);
  }
}

module.exports = DocumentNotification;
