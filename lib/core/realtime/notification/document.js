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
 * Document notification document
 *
 * @class DocumentNotification
 */
class DocumentNotification {
  constructor (opts) {
    this.type = 'document';

    this.status = opts.status;
    this.action = opts.action;
    this.scope = opts.scope;
    this.result = opts.result;
    this.node = opts.node;

    this.event = getEvent(this.action);

    this.requestId = opts.requestId;
    this.timestamp = opts.timestamp;
    this.volatile = opts.volatile;
    this.index = opts.index;
    this.collection = opts.collection;
    this.controller = opts.controller;
    this.protocol = opts.protocol;
  }

  /**
   * Instantiates a DocumentNotification object from a KuzzleRequest
   *
   * @param {Request} request - the request object from which the notification is issued
   * @param {string} scope - The scope of the notification (in or out)
   * @param {state} state - The document state (pending or done)
   * @param {action} action - Action performed on the document
   * @param {result} content - Notification content
   * @returns {DocumentNotification}
   */
  static fromRequest (request, scope, action, result) {
    return new DocumentNotification({
      action,
      collection: request.input.resource.collection,
      controller: request.input.controller,
      index: request.input.resource.index,
      node: global.kuzzle.id,
      protocol: request.context.connection.protocol,
      requestId: request.id,
      result,
      scope,
      status: 200,
      timestamp: request.timestamp,
      volatile: request.input.volatile,
    });
  }
}

module.exports = DocumentNotification;
