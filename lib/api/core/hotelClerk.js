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
  Bluebird = require('bluebird'),
  { Request } = require('kuzzle-common-objects'),
  errorsManager = require('../../util/errors');

const realtimeError = errorsManager.wrap('core', 'realtime');

class HotelClerk {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;

    /**
     * Number of created rooms. Used with the "subscriptionRooms"
     * configuration limit
     */
    this.roomsCount = 0;

    /**
     * A simple list of rooms, containing their associated filter and how many users have subscribed to it
     *
     * Example: subscribing to a chat room where the subject is Kuzzle
     *  rooms = Map<roomId, room>
     *
     * Where:
     *   - the room ID is the filter ID (e.g. 'f45de4d8ef4f3ze4ffzer85d4fgkzm41')
     *   - room is an object with the following properties:
     *   {
     *      customers: Set([ 'connectionId' ]), // -> list of users subscribing to this room
     *      channels: {                    // -> room channels
     *        'roomId-<configurationHash>': {   // channel name
     *          scope: 'all|in|out|none',       // request scope filter, default: 'all'
     *          users: 'all|in|out|none'        // filter users notifications, default: 'none'
     *        }
     *      },
     *      index: 'index', // -> the index name
     *      collection: 'collection', // -> the collection name
     *      id: 'id', // -> the room unique identifier
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

  /**
   * Link a user connection to a room.
   * Create a new room if one doesn't already exist.
   * Notify other subscribers on this room about this new subscription
   *
   * @param {Request} request
   * @return {Promise} promise. Return a NotificationObject on success.
   *                            Reject with error if the user has already
   *                            subscribed to this room name (just for rooms
   *                            with same name, there is no error if the room
   *                            has a different name with same filter) or if
   *                            there is an error during room creation
   */
  addSubscription (request) {
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
    if (!this.kuzzle.router.isConnectionAlive(request.context)) {
      return Bluebird.resolve();
    }

    return this
      ._createRoom(
        request.input.resource.index,
        request.input.resource.collection,
        request.input.body)
      .then(response => {
        Object.assign(diff, response.diff);

        return this._subscribeToRoom(response.roomId, request);
      })
      .then(subResponse => {
        if (subResponse.diff) {
          Object.assign(diff, subResponse.diff);
          return this.kuzzle.pipe('core:hotelClerk:addSubscription', diff)
            .then(() => subResponse.data);
        }

        return subResponse.data;
      });
  }

  /**
   * Return the subscribers count on a given room
   *
   * @param {Request} request
   * @returns {Object}
   */
  countSubscription (request) {
    const
      roomId = request.input.body.roomId,
      room = this.rooms.get(roomId);

    if (room === undefined) {
      realtimeError.throw('room_not_found', roomId);
    }

    return {count: room.customers.size};
  }

  /**
   * Given an index, returns an array of collections on which some filters are registered
   * @param {string} index
   * @returns {Array}
   */
  getRealtimeCollections (index) {
    return this.kuzzle.koncorde.getCollections(index);
  }

  /**
   * Joins an existing room.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  join (request) {
    const roomId = request.input.body.roomId;

    if (!this.rooms.has(roomId)) {
      realtimeError.throw('room_not_found', roomId);
    }

    let result;

    return this._subscribeToRoom(roomId, request)
      .then(response => {
        result = response.data;
        return this.kuzzle.pipe('core:hotelClerk:join', response.diff);
      })
      .then(() => result);
  }

  /**
   * Return all rooms for all filters for all collections
   * with for each rooms the total number of subscribers
   *
   * @param {Request} request
   * @returns {Promise} resolve an object with collection, rooms, subscribers
   */
  listSubscriptions (request) {
    const
      list = {},
      promises = [];

    for (const index of this.kuzzle.koncorde.getIndexes()) {
      for (const collection of this.kuzzle.koncorde.getCollections(index)) {
        const isAllowedRequest = new Request({
          controller: 'document',
          action: 'search',
          index,
          collection
        }, request.context);

        promises.push(request.context.user.isActionAllowed(isAllowedRequest)
          .then(isAllowed => {
            if (!isAllowed) {
              return;
            }

            for (const roomId of this.kuzzle.koncorde.getFilterIds(index, collection)) {
              const room = this.rooms.get(roomId);
              // the room may be currently registered in the real-time engine
              // and not in the hotel clerk
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

    return Bluebird.all(promises)
      .then(() => {
        if (!request.input.args.sorted) {
          return list;
        }

        const sorted = {};

        for (const index of Object.keys(list).sort()) {
          if (!sorted[index]) {
            sorted[index] = {};
          }

          for (const collection of Object.keys(list[index]).sort()) {
            if (!sorted[index][collection]) {
              sorted[index][collection] = {};
            }

            for (const roomId of Object.keys(list[index][collection]).sort()) {
              sorted[index][collection][roomId] = list[index][collection][roomId];
            }
          }
        }

        return sorted;
      });
  }

  /**
   * This function will delete a user from this.customers, and
   * decrement the subscribers count in all rooms where he has subscribed to
   * Usually called on a user disconnection event
   *
   * @param {RequestContext} requestContext
   * @return {Promise}
   */
  removeCustomerFromAllRooms (requestContext) {
    const customer = this.customers.get(requestContext.connection.id);

    if (!customer) {
      // No need to raise an error if the connection has already been cleaned up
      return Bluebird.resolve();
    }

    const promises = [];

    for (const roomId of customer.keys()) {
      promises.push(
        this._removeRoomForCustomer(requestContext, roomId)
          .catch(err => this.kuzzle.log.error(err)));
    }

    return Bluebird.all(promises);
  }

  /**
   * Remove rooms for a given collection
   * If rooms attribute is not provided, all rooms for the collection are removed
   *
   * @throws
   * @param {Request} request
   * @return {Object}
   */
  removeRooms (request) {
    const { index, collection } = request.input.resource;

    if (!this.kuzzle.koncorde.exists(index, collection)) {
      return { acknowledged: true };
    }

    if (request.input.body && request.input.body.rooms) {
      if (!Array.isArray(request.input.body.rooms)) {
        realtimeError.throw('invalid_rooms');
      }

      const
        rooms = request.input.body.rooms,
        partialErrors = this._removeListRoomsInCollection(index, collection, rooms);

      return {acknowledged: true, partialErrors};
    }

    this._removeAllRoomsInCollection(index, collection);
    return { acknowledged: true };
  }

  /**
   * Remove the connection.id from the room and delete it if there is no
   * subscriber left in it
   *
   * @param {Request} request
   * @returns {Promise.<String>} removed room unique identifier
   */
  removeSubscription (request) {
    return this._removeRoomForCustomer(
      request.context, request.input.body.roomId);
  }

  /**
   * Associate the room to the connection id in this.clients
   * Allow to manage later disconnection and delete socket/rooms/...
   *
   * @param {Request} request
   * @param {string} roomId
   * @param {object} volatile
   */
  _addRoomForCustomer (request, roomId, volatile) {
    let customer = this.customers.get(request.context.connection.id);

    if (!customer) {
      customer = new Map();
      this.customers.set(request.context.connection.id, customer);
    }

    this.rooms.get(roomId).customers.add(request.context.connection.id);
    customer.set(roomId, volatile);
  }

  /**
   * Create a channel object and resolve it
   *
   * @param {Request} request
   * @return {NotificationObject}
   */
  _createChannelConfiguration (request) {
    const
      channel = {},
      allowed = ['all', 'in', 'out', 'none'];

    channel.scope = request.input.args.scope || 'all';
    if (!allowed.includes(channel.scope)) {
      realtimeError.throw('invalid_scope');
    }

    channel.users = request.input.args.users || 'none';
    if (!allowed.includes(channel.users)) {
      realtimeError.throw('invalid_users');
    }

    return channel;
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
  _createRoom (index, collection, filters) {
    if (!index) {
      return errorsManager.reject('api', 'assert', 'missing_argument', 'index');
    }

    if (!collection) {
      return errorsManager.reject('api', 'assert', 'missing_argument', 'collection');
    }

    return this.kuzzle.koncorde.normalize(index, collection, filters)
      .then(normalized => {
        if (this.rooms.has(normalized.id)) {
          return {
            roomId: normalized.id,
            diff: {
              index,
              collection,
              filters: normalized.normalized
            }
          };
        }

        if ( this.kuzzle.config.limits.subscriptionMinterms > 0
          && normalized.normalized.length > this.kuzzle.config.limits.subscriptionMinterms
        ) {
          realtimeError.throw(
            'too_many_terms',
            this.kuzzle.config.limits.subscriptionMinterms,
            normalized.normalized.length);
        }

        if ( this.kuzzle.config.limits.subscriptionRooms > 0
          && this.roomsCount >= this.kuzzle.config.limits.subscriptionRooms
        ) {
          realtimeError.throw('too_many_rooms');
        }

        const
          response = this.kuzzle.koncorde.store(normalized),
          roomId = response.id;

        this.kuzzle.emit('room:new', {index, collection, roomId: response.id});

        /*
         In some very rare cases, the room may have been created between
         the beginning of the function executed at the end of normalize,
         and this one

         Before incrementing the rooms count, we have to make sure this
         is not the case to ensure our counter is right
         */
        if (!this.rooms.has(roomId)) {
          this.roomsCount++;

          this.rooms.set(roomId, {
            index,
            collection,
            id: roomId,
            customers: new Set(),
            channels: {}
          });
        }

        return {roomId, diff: response.diff};
      });
  }

  /**
   * Remove all rooms for provided collection
   * Will remove room from the real-time engine, from the rooms list and for each customers.
   *
   * @this HotelClerk
   * @param index
   * @param collection
   */
  _removeAllRoomsInCollection (index, collection) {
    // we need a copy of the array as it will be progressively be destroyed
    const realtimeFilters = Array.from(this.kuzzle.koncorde.getFilterIds(index, collection));

    for (const roomId of realtimeFilters) {
      this._removeRoomEverywhere(roomId);
    }
  }

  /**
   * @this HotelClerk
   * @param {string} index
   * @param {string} collection
   * @param {String[]} rooms
   */
  _removeListRoomsInCollection (index, collection, rooms) {
    const partialErrors = [];

    for (const roomId of rooms) {
      const room = this.rooms.get(roomId);

      if (!room) {
        partialErrors.push(`No room with id ${roomId}`);
      }
      else if (room.index !== index) {
        partialErrors.push(`The room ${roomId} does not match index ${index}`);
      }
      else if (room.collection !== collection) {
        partialErrors.push(`The room ${roomId} does not match collection ${collection}`);
      }
      else {
        this._removeRoomEverywhere(roomId);
      }
    }

    return partialErrors;
  }

  /**
   * Remove a roomId for all customers (allow to delete a room everywhere)
   *
   * @this HotelClerk
   * @param roomId
   */
  _removeRoomForAllCustomers (roomId) {
    for (const customerId of this.rooms.get(roomId).customers.values()) {
      const customer = this.customers.get(customerId);

      if (customer) {
        customer.delete(roomId);
      }
    }
  }

  /**
   * Remove a room everywhere: in customers, in the real-time engine and in
   * this.rooms
   * Allow to delete a room with action admin/removeRooms or admin/removeRooms
   *
   * @this HotelClerk
   * @param roomId
   */
  _removeRoomEverywhere (roomId) {
    const room = this.rooms.get(roomId);

    if (!room) {
      // room is not registered. Nothing to do but warn in case of
      this.kuzzle.log.warn(`hotelClerk._removeRoomEveryWhere could not find room ${roomId}`);
      return;
    }

    this._removeRoomForAllCustomers(roomId);
    this.roomsCount--;
    this.rooms.delete(roomId);
    this._removeRoomFromRealtimeEngine(roomId);
  }

  /**
   * Remove the room from subscribed room from the user
   * Return the roomId in user mapping
   *
   * @this HotelClerk
   * @param {RequestContext} requestContext
   * @param {string} roomId
   * @param {Boolean} [notify]
   * @return {Promise.<string>}
   */
  _removeRoomForCustomer (requestContext, roomId, notify = true) {
    const
      userId = requestContext.connection.id,
      customer = this.customers.get(userId);

    if (!customer) {
      return realtimeError.reject('not_subscribed', userId, roomId);
    }

    const volatile = customer.get(roomId);

    if (volatile === undefined) {
      return realtimeError.reject('not_subscribed', userId, roomId);
    }

    if (customer.size > 1) {
      customer.delete(roomId);
    }
    else {
      this.customers.delete(userId);
    }

    const room = this.rooms.get(roomId);

    if (!room) {
      this.kuzzle.log.error(`hotelClerk:removeRoom room id ${roomId} not found`);
      return realtimeError.reject('room_not_found', roomId);
    }

    for (const channel of Object.keys(room.channels)) {
      this.kuzzle.entryPoints.leaveChannel(channel, requestContext.connection.id);
    }

    if (room.customers.size === 1) {
      this.roomsCount--;
      this.rooms.delete(roomId);

      try {
        this._removeRoomFromRealtimeEngine(roomId);
      }
      catch(err) {
        return Bluebird.reject(err);
      }

      room.customers = new Set();
    }
    else {
      room.customers.delete(requestContext.connection.id);
    }

    // even if the room is deleted for this node, another one may need the notification
    const request = new Request(
      {
        controller: 'realtime',
        action: 'unsubscribe',
        index: room.index,
        collection: room.collection,
        volatile
      },
      requestContext);

    return this.kuzzle.notifier
      .notifyUser(roomId, request, 'out', {count: room.customers.size})
      .then(() => {
        if (notify) {
          return this.kuzzle.pipe(
            'core:hotelClerk:removeRoomForCustomer',
            { requestContext, room });
        }

        return null;
      })
      .then(() => roomId);
  }

  /**
   * Deletes a room if no user has subscribed to it, and removes it also from the
   * real-time engine
   *
   * @this HotelClerk
   * @param {string} roomId
   */
  _removeRoomFromRealtimeEngine (roomId) {
    this.kuzzle.emit('room:remove', roomId);
    this.kuzzle.koncorde.remove(roomId);
  }

  /**
   * subscribe the user to an existing room.
   *
   * @this HotelClerk
   * @param {string} roomId
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  _subscribeToRoom (roomId, request) {
    let
      changed = false,
      notifyPromise;
    const
      channel = this._createChannelConfiguration(request),
      channelName = `${roomId}-${this.kuzzle.constructor.hash(channel)}`,
      connectionId = request.context.connection.id,
      customer = this.customers.get(connectionId),
      room = this.rooms.get(roomId),
      diff = {
        roomId,
        connectionId,
        index: room.index,
        collection: room.collection
      };

    if ( !customer || !customer.has(roomId)) {
      changed = true;
      this._addRoomForCustomer(request, roomId, request.input.volatile);

      notifyPromise = this.kuzzle.notifier.notifyUser(
        roomId,
        request,
        'in',
        { count: room.customers.size });
    }
    else {
      notifyPromise = Bluebird.resolve();
    }

    this.kuzzle.entryPoints.joinChannel(
      channelName,
      request.context.connection.id);

    if (!room.channels[channelName]) {
      changed = true;
      room.channels[channelName] = channel;
    }

    diff.changed = changed;

    return notifyPromise
      .then(() => ({diff, data: {roomId, channel: channelName}}));
  }
}

module.exports = HotelClerk;
