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
  Request = require('kuzzle-common-objects').Request,
  {
    BadRequestError,
    InternalError: KuzzleInternalError,
    NotFoundError,
    SizeLimitError
  } = require('kuzzle-common-objects').errors;

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
     *  rooms = {
     *    'f45de4d8ef4f3ze4ffzer85d4fgkzm41' : { // -> the room unique ID (=== the filter unique ID)
     *      customers: Set([ 'connectionId' ]), // -> list of users subscribing to this room
     *      channels: {                    // -> room channels
     *        'roomId-<configurationHash>': {   // channel name
     *          state: 'all|pending|done',      // request state filter, default: 'done'
     *          scope: 'all|in|out|none',       // request scope filter, default: 'all'
     *          users: 'all|in|out|none'        // filter users notifications, default: 'none'
     *        }
     *      },
     *      index: 'index', // -> the index name
     *      collection: 'collection', // -> the collection name
     *    }
     *  }
     */
    this.rooms = {};

    /**
     * In addition to this.rooms, this.customers allows managing users and their rooms
     * Example for a customer who subscribes to the room 'chat-room-kuzzle'
     * customers = {
     *  '87fd-gre7ggth544z' : { // -> connection id (like socket id)
     *      'fr4fref4f8fre47fe': { // -> subscribed rooms id
     *        // volatile data for this customer's subscription on that room
     *      }
     *   }
     * }
     */
    this.customers = {};
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
          this.kuzzle.emit('core:hotelClerk:addSubscription', diff);
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
    const room = this.rooms[request.input.body.roomId];

    if (room === undefined) {
      throw new NotFoundError(`The room Id "${request.input.body.roomId}" does not exist`);
    }

    return {count: this.rooms[request.input.body.roomId].customers.size};
  }

  /**
   * Given an index, returns an array of collections on which some filters are registered
   * @param {string} index
   * @returns {Array}
   */
  getRealtimeCollections (index) {
    if (this.kuzzle.realtime.storage.filtersIndex[index]) {
      return Object.keys(this.kuzzle.realtime.storage.filtersIndex[index]);
    }

    return [];
  }

  /**
   * Joins an existing room.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  join (request) {
    const roomId = request.input.body.roomId;

    if (!this.rooms[roomId]) {
      throw new NotFoundError(`The room id "${roomId}" does not exist`);
    }

    return this._subscribeToRoom(roomId, request)
      .then(response => {
        this.kuzzle.emit('core:hotelClerk:join', response.diff);
        return response.data;
      });
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
      promises = [],
      realtimeIndex = this.kuzzle.realtime.storage.filtersIndex;

    for (const index of Object.keys(realtimeIndex)) {
      for (const collection of Object.keys(realtimeIndex[index])) {
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

            // the room may have been deleted in the meantime
            if (!realtimeIndex[index] || !realtimeIndex[index][collection]) {
              return;
            }

            for (const roomId of realtimeIndex[index][collection]) {
              const room = this.rooms[roomId];
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
   * @return {Promise} [description]
   */
  removeCustomerFromAllRooms (requestContext) {
    const id = requestContext.connection.id;

    if (!this.customers[id]) {
      // No need to raise an error if the connection has already been cleaned up
      return Bluebird.resolve();
    }

    const promises = [];

    for (const roomId of Object.keys(this.customers[id])) {
      promises.push(
        this._removeRoomForCustomer(requestContext, roomId)
          .catch(err =>this.kuzzle.emit('log:error', err)));
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
    if (!this.kuzzle.realtime.exists(request.input.resource.index, request.input.resource.collection)) {
      throw new NotFoundError(`No subscription found on index ${request.input.resource.index} and collection ${request.input.resource.collection}`);
    }

    if (request.input.body && request.input.body.rooms) {
      if (!Array.isArray(request.input.body.rooms)) {
        throw new BadRequestError('The rooms attribute must be an array');
      }

      const
        {index, collection} = request.input.resource,
        rooms = request.input.body.rooms,
        partialErrors = this._removeListRoomsInCollection(index, collection, rooms);

      return {acknowledged: true, partialErrors};
    }

    this._removeAllRoomsInCollection(request.input.resource.index, request.input.resource.collection);
    return {acknowledged: true};
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
    if (!this.customers[request.context.connection.id]) {
      this.customers[request.context.connection.id] = {};
    }

    this.rooms[roomId].customers.add(request.context.connection.id);
    this.customers[request.context.connection.id][roomId] = volatile;
  }

  /**
   * Create a channel object and resolve it
   *
   * @param {Request} request
   * @return {NotificationObject}
   */
  _createChannelConfiguration (request) {
    const channel = {};

    if (request.input.args.state && ['all', 'done', 'pending'].indexOf(request.input.args.state) === -1) {
      throw new BadRequestError('Incorrect value for the "state" parameter. Expected: all, done or pending. Got: ' + request.input.args.state);
    }
    channel.state = request.input.args.state || 'done';

    if (request.input.args.scope && ['all', 'in', 'out', 'none'].indexOf(request.input.args.scope) === -1) {
      throw new BadRequestError('Incorrect value for the "scope" parameter. Expected: all, in, out or none. Got: ' + request.input.args.scope);
    }
    channel.scope = request.input.args.scope || 'all';

    if (request.input.args.users && ['all', 'in', 'out', 'none'].indexOf(request.input.args.users) === -1) {
      throw new BadRequestError('Incorrect value for the "users" parameter. Expected: all, in, out or none. Got: ' + request.input.args.users);
    }
    channel.users = request.input.args.users || 'none';

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
    if (!index || !collection) {
      return Bluebird.reject(new BadRequestError('Cannot subscribe without an index and a collection'));
    }

    return this.kuzzle.realtime.normalize(index, collection, filters)
      .then(normalized => {
        if (this.rooms[normalized.id]) {
          return {
            roomId: normalized.id,
            diff: {
              index,
              collection,
              filters: normalized.normalized
            }
          };
        }

        if (this.kuzzle.config.limits.subscriptionMinterms > 0
          && normalized.normalized.length > this.kuzzle.config.limits.subscriptionMinterms
        ) {
          throw new SizeLimitError(`Unable to subscribe: maximum number of minterms exceeded (max ${this.kuzzle.config.limits.subscriptionMinterms}, received ${normalized.normalized.length})`);
        }

        if (this.kuzzle.config.limits.subscriptionRooms > 0 && this.roomsCount >= this.kuzzle.config.limits.subscriptionRooms) {
          throw new SizeLimitError('Unable to subscribe: maximum number of unique rooms reached');
        }

        const
          response = this.kuzzle.realtime.store(normalized),
          roomId = response.id;

        this.kuzzle.emit('room:new', {index, collection, roomId: response.id});

        /*
         In some very rare cases, the room may have been created between
         the beginning of the function executed at the end of normalize,
         and this one

         Before incrementing the rooms count, we have to make sure this
         is not the case to ensure our counter is right
         */
        if (!this.rooms[roomId]) {
          this.roomsCount++;

          this.rooms[roomId] = {
            index,
            collection,
            id: roomId,
            customers: new Set(),
            channels: {}
          };
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
    const realtimeFilters = Array.from(this.kuzzle.realtime.getFilterIds(index, collection));

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
      if (!this.rooms[roomId]) {
        // don't stop the loop if error occurred but return a partial error to user
        partialErrors.push(`No room with id ${roomId}`);
      }
      else if (this.rooms[roomId].index !== index) {
        // don't stop the loop if error occurred but return a partial error to user
        partialErrors.push(`The room ${roomId} does not match index ${index}`);
      }
      else if (this.rooms[roomId].collection !== collection) {
        // don't stop the loop if error occurred but return a partial error to user
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
    for (const customer of this.rooms[roomId].customers.values()) {
      if (this.customers[customer] && this.customers[customer][roomId]) {
        delete this.customers[customer][roomId];
      }
    }
  }

  /**
   * Remove a room everywhere: in customers, in the real-time engien and in this.rooms
   * Allow to delete a room with action admin/removeRooms or admin/removeRooms
   *
   * @this HotelClerk
   * @param roomId
   */
  _removeRoomEverywhere (roomId) {
    const room = this.rooms[roomId];

    if (!room) {
      // room is not registered. Nothing to do but warn in case of
      this.kuzzle.emit('log:warn', `hotelClerk._removeRoomEveryWhere could not find room ${roomId}`);
      return;
    }

    this._removeRoomForAllCustomers(roomId);
    this.roomsCount--;
    delete this.rooms[roomId];
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
    if (!this.customers[requestContext.connection.id]) {
      return Bluebird.reject(
        new NotFoundError('Unsubscribe error: no subscription found for that user'));
    }

    const customer = this.customers[requestContext.connection.id];

    if (customer[roomId] === undefined) {
      return Bluebird.reject(
        new NotFoundError(`Unsubscribe error: not subscribed to ${roomId}`));
    }

    const volatile = customer[roomId];

    if (Object.keys(customer).length > 1) {
      delete this.customers[requestContext.connection.id][roomId];
    }
    else {
      delete this.customers[requestContext.connection.id];
    }

    const room = this.rooms[roomId];

    if (!room) {
      this.kuzzle.emit(
        'log:error', `hotelClerk:removeRoom room id ${roomId} not found`);
      return Bluebird.reject(
        new KuzzleInternalError(`Unsubscribe error: room ${roomId} not found`));
    }

    for (const channel of Object.keys(room.channels)) {
      this.kuzzle.entryPoints.leaveChannel(channel, requestContext.connection.id);
    }

    if (room.customers.size === 1) {
      this.roomsCount--;
      delete this.rooms[roomId];
      this._removeRoomFromRealtimeEngine(roomId);
      room.customers = new Set();
    }
    else {
      room.customers.delete(requestContext.connection.id);
    }

    // even if the room is deleted for this node, another one may need the notification
    const request = new Request({
      controller: 'realtime',
      action: 'unsubscribe',
      index: room.index,
      collection: room.collection,
      volatile
    }, requestContext);

    return this.kuzzle.notifier.notifyUser(
      roomId, request, 'out', {count: room.customers.size})
      .then(() => {
        if (notify) {
          this.kuzzle.emit(
            'core:hotelClerk:removeRoomForCustomer', {requestContext, room});
        }

        return roomId;
      });
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
    this.kuzzle.realtime.remove(roomId);
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
      diff = {
        roomId,
        connectionId,
        index: this.rooms[roomId].index,
        collection: this.rooms[roomId].collection
      };

    if (!this.customers[connectionId] ||
      this.customers[connectionId][roomId] === undefined
    ) {
      changed = true;
      this._addRoomForCustomer(request, roomId, request.input.volatile);

      notifyPromise = this.kuzzle.notifier.notifyUser(
        roomId, request, 'in', {count: this.rooms[roomId].customers.size});
    } else {
      notifyPromise = Bluebird.resolve();
    }

    this.kuzzle.entryPoints.joinChannel(
      channelName, request.context.connection.id);

    if (!this.rooms[roomId].channels[channelName]) {
      changed = true;
      this.rooms[roomId].channels[channelName] = channel;
    }

    diff.changed = changed;

    return notifyPromise
      .then(() => ({diff, data: {roomId, channel: channelName}}));
  }
}

module.exports = HotelClerk;
