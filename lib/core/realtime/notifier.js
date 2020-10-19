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

const { difference } = require('lodash');
const Bluebird = require('bluebird');

const kerror = require('../../kerror');
const actionEnum = require('./actionEnum');
const {
  DocumentNotification,
  ServerNotification,
  UserNotification,
} = require('./notification');


/**
 * @typedef {Object} DocumentChanges
 * @property {string}  _id              of the document
 * @property {Object}  [_source]        of the document
 * @property {Object}  [_updatedFields] applied to the document (for updates)
 * @property {boolean} [created]        -- tells if this is a CREATE or REPLACE
 *                                      (for actionEnum.WRITE)
 */

/**
 * @class NotifierController
 */
class NotifierController {
  constructor(kuzzle, realtimeModule) {
    this.kuzzle = kuzzle;
    this.module = realtimeModule;
    this.ttl = this.kuzzle.config.limits.subscriptionDocumentTTL;
  }

  async init () {
    /**
     * Low-level document notification method, allocating a new Notification
     * message and dispatching it to a precomputed list of rooms.
     * @param {Array.<string>} rooms - list of koncorde rooms to notify
     * @param {Request} request
     * @param {string} scope
     * @param {string} action
     * @param {Object} content
     * @param {Object} [opts]
     */
    this.kuzzle.onAsk(
      'core:realtime:document:dispatch',
      (rooms, request, scope, action, content, opts) => {
        return this._notifyDocument(rooms, request, scope, action, content, opts);
      });


    /**
     * Low-level user notification method, allocating a new Notification
     * message and dispatching it to the provided room
     * @param {string} room
     * @param {Request} request
     * @param {string} scope
     * @param {Object} content
     * @param {Object} [opts]
     */
    this.kuzzle.onAsk(
      'core:realtime:user:sendMessage',
      (room, request, scope, content, opts) => {
        return this._notifyUser(room, request, scope, content, opts);
      });

    /**
     * Notify about document creations, updates, replacements or deletions
     * @param {Request} request
     * @param {notifyActionEnum} action applied to documents
     * @param {Array.<DocumentChanges>} docs
     */
    this.kuzzle.onAsk(
      'core:realtime:document:mNotify',
      (request, action, docs) => this.notifyDocuments(request, action, docs));

    /**
     * Notify about document creations, updates, replacements or deletions
     * @param {Request} request
     * @param {notifyActionEnum} action applied to documents
     * @param {DocumentChanges} doc
     */
    this.kuzzle.onAsk(
      'core:realtime:document:notify',
      (request, action, doc) => this.notifyDocuments(request, action, [doc]));


    /**
     * Send a "token expired" notification to the target user
     * @param {string} connectionId
     */
    this.kuzzle.onAsk(
      'core:realtime:tokenExpired:notify',
      connectionId => this.notifyTokenExpired(connectionId));

    /**
     * Publish the provided request content to listening subscribers
     * @param {Request} request
     */
    this.kuzzle.onAsk('core:realtime:publish', request => this.publish(request));
  }

  /**
   * Broadcasts a notification about a document change or a
   * real-time message
   *
   * @param {Array} rooms - Subscribed rooms to notify
   * @param {Request} request - Request at the origin of the notification
   * @param {string} scope - 'in' or 'out'
   * @param {object} content - Document or message
   *
   * @returns {Promise}
   */
  async notifyDocument (rooms, request, scope, action, content) {
    if (rooms.length === 0) {
      return;
    }

    this.kuzzle.emit('core:notify:document', {
      action,
      content,
      request: request.serialize(),
      rooms,
      scope,
    });

    await this._notifyDocument(rooms, request, scope, action, content, {
      fromCluster: false
    });
  }

  /**
   * Broadcast a notification about a user entering or leaving
   * the provided room
   *
   * @param {string} room - Room entered or left
   * @param {Request} request - User (un)subscription request
   * @param {string} scope - 'in' or 'out'
   * @param {object} content - Notification additional informations
   *
   * @returns {Promise}
   */
  notifyUser (room, request, scope, content) {
    this.kuzzle.emit('core:notify:user', {
      content,
      request: request.serialize(),
      room,
      scope
    });

    return this._notifyUser(room, request, scope, content, {
      fromCluster: false
    });
  }

  /**
   * Send a "token expired" notification to the target user
   *
   * @param {string} connectionId - User's connection identifier
   * @returns {Promise}
   */
  async notifyTokenExpired (connectionId) {
    const rooms = this.module.hotelClerk.getUserRooms(connectionId);

    if (rooms.length === 0) {
      return;
    }

    const channels = [];

    for (const room of rooms) {
      const hotelClerkRoom = this.module.hotelClerk.rooms.get(room);

      if (hotelClerkRoom !== undefined) {
        channels.push(...Object.keys(hotelClerkRoom.channels));
      }
    }

    if (channels.length > 0) {
      await this._dispatch(
        'notify:server',
        channels,
        new ServerNotification('TokenExpired', 'Authentication Token Expired'),
        connectionId);
    }

    await this.module.hotelClerk.removeUser(connectionId);
  }

  /**
   * Publish the content of the provided request to listening subscribers
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  publish (request) {
    const rooms = this._test(request);

    if (rooms.length === 0) {
      return Bluebird.resolve(null);
    }

    return this.notifyDocument(rooms, request, 'in', 'publish', {
      _id: request.input.resource._id,
      _source: request.input.body,
    });
  }

  /**
   * Notify about a created document
   *
   * @param {Request} request
   * @param {DocumentChanges} document created
   * @returns {Promise.<Array.<string>>} list of matched rooms
   */
  async notifyDocumentCreate (request, document) {
    const rooms = this._test(request, document._source, document._id);

    if (rooms.length > 0) {
      await this.notifyDocument(rooms, request, 'in', 'create', document);
    }

    return rooms;
  }

  /**
   * Notify about a replaced document
   *
   * @param {Request} request
   * @param {DocumentChanges} document
   * @param {string} cache notification content for that document
   * @returns {Promise.<Array.<string>} list of matched rooms
   */
  async notifyDocumentReplace (request, document, cache = null) {
    const rooms = this._test(request, document._source, document._id);

    if (rooms.length > 0) {
      await this.notifyDocument(rooms, request, 'in', 'replace', document);
    }

    if (cache !== null) {
      const stopListening = difference(JSON.parse(cache), rooms);

      await this.notifyDocument(stopListening, request, 'out', 'replace', {
        _id: document._id,
      });
    }

    return rooms;
  }

  /**
   * Computes document notifications and sends them to subscribed users.
   * @param  {Request} request
   * @param  {notifyActionEnum} action
   * @param  {Array.<DocumentChanges>} documents
   * @return {Promise}
   */
  async notifyDocuments (request, action, documents) {
    const prefix = getCachePrefix(request);
    let cached = action === actionEnum.REPLACE || action === actionEnum.UPDATE;

    const cacheIds = documents.map(doc => {
      if (action === actionEnum.WRITE && !cached) {
        cached = doc.created !== true; // force a bool value if undefined
      }

      return prefix + doc._id;
    });

    const cache = cached
      ? await this.kuzzle.ask('core:cache:internal:mget', cacheIds)
      : [];

    const result = await Bluebird.map(documents, (doc, index) => {
      switch(action) {
        case actionEnum.CREATE:
          return this.notifyDocumentCreate(request, doc);
        case actionEnum.DELETE:
          return this.notifyDocumentDelete(request, doc);
        case actionEnum.REPLACE:
          return this.notifyDocumentReplace(request, doc, cache[index]);
        case actionEnum.UPDATE:
          return this.notifyDocumentUpdate(request, doc, cache[index]);
        case actionEnum.WRITE:
          if (doc.created) {
            return this.notifyDocumentCreate(request, doc);
          }
          return this.notifyDocumentReplace(request, doc, cache[index]);
        default:
          throw kerror.get('core', 'fatal', 'assertion_failed', `unknown notify action "${doc.action}"`);
      }
    });

    const toDelete = [];

    await Bluebird.map(result, (rooms, index) => {
      if (rooms.length > 0) {
        return this.kuzzle.ask(
          'core:cache:internal:store',
          cacheIds[index],
          JSON.stringify(rooms),
          { ttl: this.ttl });
      }

      toDelete.push(cacheIds[index]);
      return null;
    });

    if (toDelete.length > 0) {
      await this.kuzzle.ask('core:cache:internal:del', toDelete);
    }
  }

  /**
   * Notify rooms on a document update
   * @param {Request} request
   * @param {DocumentChanges} document
   * @param {string} cache notification content for that document
   * @returns {Promise.<Array.<string>} list of matched rooms
   */
  async notifyDocumentUpdate (request, document, cache = null) {
    const rooms = this._test(request, document._source, document._id);

    if (rooms.length > 0) {
      await this.notifyDocument(rooms, request, 'in', 'update', document);
    }

    if (cache !== null) {
      const stopListening = difference(JSON.parse(cache), rooms);

      await this.notifyDocument(stopListening, request, 'out', 'update', {
        _id: document._id,
      });
    }

    return rooms;
  }

  /**
   * Notify about a document deletion
   *
   * @param {Request} request
   * @param {DocumentChanges} document
   * @returns {Promise.<Array>} returns an empty array ("no room match anymore")
   */
  async notifyDocumentDelete (request, document) {
    const rooms = this._test(request, document._source, document._id);

    if (rooms.length > 0) {
      await this.notifyDocument(rooms, request, 'out', 'delete', {
        _id: document._id,
      });
    }

    return [];
  }

  /**
   * Trigger a notify global event and, if accepted by plugins,
   * dispatch the payload to subscribers
   *
   * @param {Array} channels - Subscribers channels to notify
   * @param {Notification.User|Notification.Document|Notification.Server} notification
   * @param {string} [connectionId] - Notify this connection, or broadcast
   *                                   if not provided
   * @param {boolean} [trigger] - If set to true, triggers Kuzzle plugins
   *
   * @returns {Promise}
   */
  async _dispatch (event, channels, notification, connectionId) {
    try {
      let updated = await this.kuzzle.pipe(event, notification);
      updated = await this.kuzzle.pipe('notify:dispatch', updated);

      const action = connectionId ? 'notify' : 'broadcast';

      this.kuzzle.entryPoint.dispatch(action, {
        channels,
        connectionId,
        payload: updated
      });
    }
    catch (error) {
      this.kuzzle.log.error(error);
    }
  }

  /**
   * Broadcasts a notification about a document change or a
   * real-time message.
   *
   * When this method is called from the node who received
   * the request triggering notification, then every channel is notified
   * regardless of the "cluster" option.
   *
   * When this method is called from the cluster synchronization,
   * then only the channels having the "cluster: true" option are notified
   *
   * @param {Array} rooms - Subscribed rooms to notify
   * @param {Request} request - Request at the origin of the notification
   * @param {string} scope - 'in' or 'out'
   * @param {string} action - Notification type
   * @param {object} content - Document or message
   * @param {object} [options] - fromCluster (true)
   *
   * @returns {Promise}
   */
  _notifyDocument (rooms, request, scope, action, content, { fromCluster=true } = {}) {
    const channels = [];

    for (const room of rooms) {
      const hotelClerkRoom = this.module.hotelClerk.rooms.get(room);

      if (hotelClerkRoom === undefined) {
        continue;
      }

      for (const [channelId, channel] of Object.entries(hotelClerkRoom.channels)) {
        const matchScope = channel.scope === 'all' || channel.scope === scope;
        const executeOnNode = fromCluster ? channel.cluster : true;

        if (matchScope && executeOnNode) {
          channels.push(channelId);
        }
      }
    }

    if (channels.length === 0) {
      return Bluebird.resolve();
    }

    const notif = new DocumentNotification(request, scope, action, content);

    return this._dispatch('notify:document', channels, notif);
  }

  /**
   * Broadcast a notification about a user entering or leaving
   * the provided room
   *
   * @param {string} room - Room entered or left
   * @param {Request} request - User (un)subscription request
   * @param {string} scope - 'in' or 'out'
   * @param {object} content - Notification additional informations
   *
   * @returns {Promise}
   */
  _notifyUser (room, request, scope, content, { fromCluster=true } = {}) {
    const channels = [];
    const hotelClerkRoom = this.module.hotelClerk.rooms.get(room);

    if (hotelClerkRoom !== undefined) {
      for (const [id, channel] of Object.entries(hotelClerkRoom.channels)) {
        const match = channel.users === 'all' || channel.users === scope;
        const executeOnNode = fromCluster ? channel.cluster : true;

        if (executeOnNode && match) {
          channels.push(id);
        }
      }
    }

    if (channels.length === 0) {
      return Bluebird.resolve();
    }

    const notification = new UserNotification(request, scope, content);

    return this._dispatch('notify:user', channels, notification);
  }

  /**
   * DRYification for calls to Koncorde's test method from a Request object
   * @param {Request} request
   * @param {Object} source - document's source
   * @param {String} id
   *
   * @returns {Array.<string>}
   */
  _test (request, source = null, id = null) {
    return this.kuzzle.koncorde.test(
      request.input.resource.index,
      request.input.resource.collection,
      source || request.input.body || {},
      id || request.input.resource._id);
  }
}

function getCachePrefix(request) {
  // use redis key hash tag
  // (see https://redis.io/topics/cluster-spec#keys-distribution-model)
  return `{notif/${request.input.resource.index}/${request.input.resource.collection}}/`;
}

module.exports = NotifierController;
