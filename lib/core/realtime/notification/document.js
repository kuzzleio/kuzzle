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

const { InternalError } = require('../../../kerror/errors');

function getEvent (action) {
  switch (action) {
    case 'create':
    case 'mCreate':
    case 'createOrReplace':
    case 'mCreateOrReplace':
    case 'replace':
    case 'mReplace':
    case 'update':
    case 'updateByQuery':
    case 'mUpdate':
    case 'write':
    case 'mWrite':
    case 'upsert':
      return 'write';

    case 'delete':
    case 'deleteByQuery':
    case 'mDelete':
      return 'delete';

    case 'publish':
      return 'publish';

    default:
      throw new InternalError(`Unknown event type for action "${action}"`);
  }
}
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
  constructor (request, scope, action, content) {
    this.status = 200;
    this.action = action;
    this.scope = scope;
    this.result = content;
    this.type = 'document';
    this.event = getEvent(action);

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
}

module.exports = DocumentNotification;
