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

const Bluebird = require('bluebird');

const { Request, RequestContext } = require('../../api/request');
const kerror = require('../../kerror');
const debug = require('../../util/debug')('kuzzle:realtime:hotelClerk');

const realtimeError = kerror.wrap('core', 'realtime');

const CHANNEL_ALLOWED_VALUES = ['all', 'in', 'out', 'none'];

class Channel {
  constructor (roomId, { scope='all', users='none', propagate=true } = {}) {
    this.scope = scope;
    this.users = users;
    this.cluster = propagate;

    if (! CHANNEL_ALLOWED_VALUES.includes(this.scope)) {
      throw realtimeError.get('invalid_scope');
    }

    if (! CHANNEL_ALLOWED_VALUES.includes(this.users)) {
      throw realtimeError.get('invalid_users');
    }

    this.name = `${roomId}-${global.kuzzle.hash(this)}`;
  }
}

class HotelClerk {
  constructor (realtimeModule) {
    this.module = realtimeModule;

    /**
     * Number of created rooms. Used with the "subscriptionRooms"
     * configuration limit
     */
    this.roomsCount = 0;

    /**
     * A simple list of rooms, containing their associated filter and how many
     * users have subscribed to it
     *
     * Example: subscribing to a chat room where the subject is Kuzzle
     *  rooms = Map<roomId, room>
     *
     * Where:
     *   - the room ID is the filter ID (e.g. 'f45de4d8ef4f3ze4ffzer85d4fgkzm41')
     *   - room is an object with the following properties:
     *   {
     *      // list of users subscribing to this room
     *      customers: Set([ 'connectionId' ]),
     *
     *      // room channels
     *      channels: {
     *
     *        // channel ID
     *        'roomId-<configurationHash>': {
     *
     *          // request scope filter, default: 'all'
     *          scope: 'all|in|out|none',
     *
     *          // filter users notifications, default: 'none'
     *          users: 'all|in|out|none',
     *
     *          // should propagate notification to the cluster
     *          // (used for plugin subscriptions)
     *          cluster: true|false
     *        }
     *      },
     *      index: 'index',
     *      collection: 'collection',
     *      // the room unique identifier
     *      id: 'id',
     *    }
     *  }
     */
    this.rooms = new Map();

    /**
     * In addition to this.rooms, this.customers allows managing users and their rooms
     * Example for a customer who subscribes to the room 'chat-room-kuzzle'
     * customers = Map.<connection id, customer rooms>
     *
     * Where a customer room is an object with the following properties:
     *   Map.<customer ID, Map.<room Id, volatile data>>
     */
    this.customers = new Map();
  }

  async init () {
    /**
     * Create a new, empty room.
     * @param {string} index
     * @param {string} collection
     * @param {string} roomId
     * @returns {boolean} status indicating if the room was created or not
     */
    global.kuzzle.onAsk(
      'core:realtime:room:create',
      (index, collection, roomId) => this.newRoom(index, collection, roomId));

    /**
     * Returns the number of connections listening to a given room
     *
     * @param  {string} roomId
     * @return {number}
     * @throws {NotFoundError} If the roomId does not exist
     */
    global.kuzzle.onAsk(
      'core:realtime:room:size:get',
      roomId => this.getRoomSize(roomId));


    /**
     * Joins an existing room.
     * @param  {Request} request
     * @returns {Promise}
     */
    global.kuzzle.onAsk(
      'core:realtime:join', request => this.join(request));

    /**
     * Return the list of index, collection, rooms (+ their users count)
     * on all index/collection pairs that the requesting user is allowed to
     * subscribe
     *
     * @param  {User} user
     * @return {number}
     * @throws {NotFoundError} If the roomId does not exist
     */
    global.kuzzle.onAsk('core:realtime:list', user => this.list(user));

    /**
     * Given an index, returns the list of collections having subscriptions
     * on them.
     * @param  {string} index
     * @return {Array.<string>}
     */
    global.kuzzle.onAsk(
      'core:realtime:collections:get',
      index => this.listCollections(index));

    /**
     * Removes a user and all their subscriptions.
     * @param  {string} connectionId
     */
    global.kuzzle.onAsk(
      'core:realtime:user:remove',
      connectionId => this.removeUser(connectionId));

    /**
     * Adds a new user subscription
     * @param  {Request} request
     * @return {Object|null}
     */
    global.kuzzle.onAsk(
      'core:realtime:subscribe',
      request => this.subscribe(request));

    /**
     * Unsubscribes a user from a room
     * @param {string} connectionId
     * @param {string} roomId
     * @param {boolean} [notify]
     */
    global.kuzzle.onAsk(
      'core:realtime:unsubscribe',
      (connectionId, roomId, notify) => {
        return this.unsubscribe(connectionId, roomId, notify);
      });
  }

  /**
   * Link a user connection to a room.
   * Create a new room if one doesn't already exist.
   * Notify other subscribers on this room about this new subscription
   *
   * @param {Request} request
   * @return {Promise.<UserNotification|null>}
   * @throws Throws if the user has already subscribed to this room name
   *         (just for rooms with same name, there is no error if the room
   *         has a different name with same filter) or if there is an error
   *         during room creation
   */
  async subscribe (request) {
    const diff = {};

    /*
     * /!\ This check is a duplicate to the one already made by the
     * funnel controller. THIS IS INTENTIONAL.
     *
     * This is to prevent subscriptions to be made on dead
     * connections. And between the funnel and here, there is
     * time for a connection to drop, so while the check
     * on the funnel is useful for many use cases, this one
     * is made on the very last moment and is essential to ensure
     * that no zombie subscription can be performed
     */
    if (!global.kuzzle.router.isConnectionAlive(request.context)) {
      return null;
    }

    const response = await this._createRoom(
      request.input.args.index,
      request.input.args.collection,
      request.input.body);

    Object.assign(diff, response.diff);

    const subResponse = await this._subscribeToRoom(response.roomId, request);

    if (subResponse.diff && subResponse.cluster) {
      Object.assign(diff, subResponse.diff);

      await global.kuzzle.pipe('core:realtime:user:subscribe:after', diff);

      // @deprecated -- to be removed in next major version
      await global.kuzzle.pipe('core:hotelClerk:addSubscription', diff);
    }

    return subResponse.data;
  }

  /**
   * Return the subscribers count on a given room
   *
   * @param {string} roomId
   * @returns {number}
   */
  getRoomSize (roomId) {
    const room = this.rooms.get(roomId);

    if (! room) {
      throw realtimeError.get('room_not_found', roomId);
    }

    return room.customers.size;
  }

  /**
   * Given an index, returns an array of collections on which some filters are
   * registered
   * @param {string} index
   * @returns {Array.<string>}
   */
  listCollections (index) {
    return global.kuzzle.koncorde.getCollections(index);
  }

  /**
   * Joins an existing room.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async join (request) {
    const roomId = request.input.body.roomId;

    if (! this.rooms.has(roomId)) {
      throw realtimeError.get('room_not_found', roomId);
    }

    const response = await this._subscribeToRoom(roomId, request);

    if (response.cluster) {
      await global.kuzzle.pipe('core:realtime:user:join:after', response.diff);
    }

    return response.data;
  }

  /**
   * Return the list of index, collection, rooms (+ their number of subscribers)
   * on all index/collection pairs that the requesting user is allowed to
   * subscribe
   *
   * Returned object looks like this:
   *   {
   *     <index>: {
   *       <collection>: {
   *         <roomId>: <number of subscribers>
   *       }
   *     }
   *   }
   *
   * @param {User} user
   * @returns {Promise.<Object>} resolve an object listing all rooms subscribed
   *                             by the connected user
   */
  async list (user) {
    const list = {};
    const promises = [];

    for (const index of global.kuzzle.koncorde.getIndexes()) {
      for (const collection of global.kuzzle.koncorde.getCollections(index)) {
        const isAllowedRequest = new Request({
          action: 'subscribe',
          collection,
          controller: 'realtime',
          index,
        });

        promises.push(user.isActionAllowed(isAllowedRequest)
          .then(isAllowed => {
            if (!isAllowed) {
              return;
            }

            for (const roomId of global.kuzzle.koncorde.getFilterIds(index, collection)) {
              const room = this.rooms.get(roomId);

              // filter: rooms can exist in the real-time engine,
              // and not in the hotel clerk (e.g. sync from cluster)
              if (room) {
                if (!list[index]) {
                  list[index] = {};
                }
                if (!list[index][collection]) {
                  list[index][collection] = {};
                }

                list[index][collection][roomId] = room.customers.size;
              }
            }
          }));
      }
    }

    await Bluebird.all(promises);

    return list;
  }

  /**
   * This function will delete a user from this.customers, and
   * decrement the subscribers count in all rooms where he has subscribed to
   * Usually called on a user disconnection event
   *
   * @param {string} connectionId
   */
  async removeUser (connectionId) {
    const customer = this.customers.get(connectionId);

    if (!customer) {
      // No need to raise an error if the connection has already been cleaned up
      return;
    }

    await Bluebird.map(customer.keys(), roomId => {
      return this.unsubscribe(connectionId, roomId)
        .catch(err => global.kuzzle.log.error(err));
    });
  }

  /**
   * Associate the room to the connection id in this.clients
   * Allow to manage later disconnection and delete socket/rooms/...
   *
   * @param {string} connectionId
   * @param {string} roomId
   * @param {object} volatile
   */
  _addRoomForCustomer (connectionId, roomId, volatile) {
    debug('Add room %s for customer %s', roomId, connectionId);

    let customer = this.customers.get(connectionId);

    if (! customer) {
      customer = new Map();
      this.customers.set(connectionId, customer);
    }

    this.rooms.get(roomId).customers.add(connectionId);
    customer.set(roomId, volatile);
  }

  /**
   * Create new room if needed
   *
   * @this HotelClerk
   * @param {string} index
   * @param {string} collection
   * @param {object} filters
   * @returns {Promise} promise
   */
  async _createRoom (index, collection, filters) {
    if (! index) {
      return kerror.reject('api', 'assert', 'missing_argument', 'index');
    }

    if (! collection) {
      return kerror.reject('api', 'assert', 'missing_argument', 'collection');
    }

    let normalized;
    try {
      normalized = await global.kuzzle.koncorde.normalize(
        index,
        collection,
        filters);
    }
    catch (error) {
      throw kerror.getFrom(error, 'api', 'assert', 'koncorde_dsl_error', error.message);
    }

    if (this.rooms.has(normalized.id)) {
      return {
        diff: {
          collection,
          filters: normalized.normalized,
          index
        },
        roomId: normalized.id
      };
    }

    const termsLimit = global.kuzzle.config.limits.subscriptionMinterms;

    if ( termsLimit > 0 && normalized.normalized.length > termsLimit ) {
      throw realtimeError.get(
        'too_many_terms',
        termsLimit,
        normalized.normalized.length);
    }

    const roomsLimit = global.kuzzle.config.limits.subscriptionRooms;

    if ( roomsLimit > 0 && this.roomsCount >= roomsLimit ) {
      throw realtimeError.get('too_many_rooms');
    }

    const response = global.kuzzle.koncorde.store(normalized);
    const roomId = response.id;

    global.kuzzle.emit('core:realtime:room:create:after', {
      collection,
      index,
      roomId,
    });

    // @deprecated -- to be removed in the next major version of kuzzle
    global.kuzzle.emit('room:new', { collection, index, roomId });

    /*
      In some very rare cases, the room may have been created between
      the beginning of the function executed at the end of normalize,
      and this one

      Before incrementing the rooms count, we have to make sure this
      is not the case to ensure our counter is right
      */
    if (this.newRoom(index, collection, roomId)) {
      this.roomsCount++;
    }

    return { diff: response.diff, roomId };
  }

  /**
   * Remove the room from subscribed room from the user
   * Return the roomId in user mapping
   *
   * @this HotelClerk
   * @param {string} connectionId
   * @param {string} roomId
   * @param {Boolean} [notify]
   * @returns {Promise}
   */
  async unsubscribe (connectionId, roomId, notify = true) {
    const customer = this.customers.get(connectionId);
    const requestContext = new RequestContext({
      connection: { id: connectionId }
    });

    if (! customer) {
      throw realtimeError.get('not_subscribed', connectionId, roomId);
    }

    const volatile = customer.get(roomId);

    if (volatile === undefined) {
      throw realtimeError.get('not_subscribed', connectionId, roomId);
    }

    if (customer.size > 1) {
      customer.delete(roomId);
    }
    else {
      this.customers.delete(connectionId);
    }

    const room = this.rooms.get(roomId);

    if (! room) {
      global.kuzzle.log.error(`[hotelClerk] Cannot remove room "${roomId}": room not found`);
      throw realtimeError.get('room_not_found', roomId);
    }

    for (const channel of Object.keys(room.channels)) {
      global.kuzzle.entryPoint.leaveChannel(channel, connectionId);
    }

    if (room.customers.size === 1) {
      this.roomsCount--;
      this.rooms.delete(roomId);

      await this._removeRoomFromRealtimeEngine(roomId);

      room.customers = new Set();
    }
    else {
      room.customers.delete(connectionId);
    }

    // even if the room is deleted for this node, another one may need the
    // notification
    const request = new Request(
      {
        action: 'unsubscribe',
        collection: room.collection,
        controller: 'realtime',
        index: room.index,
        volatile,
      },
      requestContext);

    await this.module.notifier.notifyUser(roomId, request, 'out', {
      count: room.customers.size
    });

    if (notify && Object.keys(room.channels).length > 0) {
      // If we have local channels, then do not propagate them
      const roomPayload = { ...room };

      if (Object.values(room.channels).some(channel => ! channel.cluster)) {
        roomPayload.channels = Object.entries(room.channels)
          .reduce((channels, [name, channel]) => {
            if (channel.cluster) {
              channels[name] = channel;
            }
            return channels;
          }, {});
      }

      await global.kuzzle.pipe('core:realtime:user:unsubscribe:after', {
        requestContext,
        room: roomPayload,
      });

      // @deprecated -- to be removed in next major version
      await global.kuzzle.pipe('core:hotelClerk:removeRoomForCustomer', {
        requestContext,
        room: roomPayload,
      });
    }
  }

  /**
   * Deletes a room if no user has subscribed to it, and removes it also from the
   * real-time engine
   *
   * @param {string} roomId
   */
  async _removeRoomFromRealtimeEngine (roomId) {
    try {
      let id = await global.kuzzle.pipe(
        'core:realtime:room:remove:before',
        roomId);

      // @deprecated -- to be removed in the next major version
      id = await global.kuzzle.pipe('room:remove', id);

      global.kuzzle.koncorde.remove(id);
    }
    catch (e) {
      debug(
        'A pipe plugged to "core:realtime:room:remove" refused the deletion of the room "%s": %s',
        roomId,
        e.message);
    }
  }

  /**
   * Subscribes a user to an existing room.
   *
   * @param {string} roomId
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async _subscribeToRoom (roomId, request) {
    let changed = false;
    let notifyPromise;
    const channel = new Channel(roomId, request.input.args);
    const connectionId = request.context.connection.id;
    const customer = this.customers.get(connectionId);
    const room = this.rooms.get(roomId);
    const diff = {
      collection: room.collection,
      connectionId,
      index: room.index,
      roomId
    };

    if ( !customer || !customer.has(roomId)) {
      changed = true;
      this._addRoomForCustomer(connectionId, roomId, request.input.volatile);

      notifyPromise = this.module.notifier.notifyUser(
        roomId,
        request,
        'in',
        { count: room.customers.size });
    }
    else {
      notifyPromise = Bluebird.resolve();
    }

    global.kuzzle.entryPoint.joinChannel(channel.name, connectionId);

    if (! room.channels[channel.name]) {
      changed = true;
      room.channels[channel.name] = channel;
    }

    diff.changed = changed;

    await notifyPromise;

    return {
      cluster: channel.cluster,
      data: {
        channel: channel.name,
        roomId
      },
      diff
    };
  }

  /**
   * Return the rooms a user has subscribed to.
   * @param  {connectionId} connectionId
   * @returns {Array.<string>}
   */
  getUserRooms (connectionId) {
    const rooms = this.customers.get(connectionId);

    if (rooms) {
      return Array.from(rooms.keys());
    }

    return [];
  }

  /**
   * Create an empty room in the RAM cache
   * @param  {string} index
   * @param  {string  } collection
   * @param  {string} roomId
   * @returns {boolean}
   */
  newRoom (index, collection, roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        channels: {},
        collection,
        customers: new Set(),
        id: roomId,
        index,
      });

      return true;
    }

    return false;
  }
}

module.exports = HotelClerk;
