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
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  {
    BadRequestError,
    NotFoundError
  } = require('kuzzle-common-objects').errors;

class HotelClerk {

  constructor (kuzzle) {
    this.kuzzle = kuzzle;

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
     *      collection: 'message', // -> the collection name
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
   *
   * @return {Promise} promise. Return a NotificationObject on success. Reject with error if the
   * user has already subscribed to this room name (just for rooms with same name, there is no error
   * if the room has a different name with same filter) or if there is an error during room creation
   */
  addSubscription (request) {
    const diff = [];

    return this._createRoom(request.input.resource.index, request.input.resource.collection, request.input.body)
      .then(response => {
        if (response.diff) {
          diff.push(response.diff);
        }

        const subResponse = this._subscribeToRoom(response.roomId, request);
        if (subResponse.diff) {
          diff.push(subResponse.diff);
          this.kuzzle.pluginsManager.trigger('core:hotelClerk:addSubscription', diff);
        }

        return subResponse.data;
      });
  }

  /**
   * Returns the list of existing channels on a given room, depending of the response object
   *
   * @param {Array} channels - channels array to amend
   * @param {string} roomId
   * @param {object} notification object
   */
  addToChannels (channels, roomId, notification) {
    const room = this.rooms[roomId];

    if (room === undefined) {
      return;
    }

    for (const channel of Object.keys(room.channels)) {
      const
        c = room.channels[channel],
        stateMatch = c.state === 'all' || !notification.state || notification.action === 'publish' || c.state === notification.state,
        scopeMatch = c.scope === 'all' || !notification.scope || c.scope === notification.scope,
        usersMatch = c.users === 'all' || notification.getUserFlag() === 'none' || c.users === notification.getUserFlag();

      if (stateMatch && scopeMatch && usersMatch) {
        channels.push(channel);
      }
    }
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
    const collections = [];

    if (this.kuzzle.dsl.storage.filtersIndex[index]) {
      for (const collection of Object.keys(this.kuzzle.dsl.storage.filtersIndex[index])) {
        collections.push(collection);
      }
    }

    return collections;
  }

  /**
   * Joins an existing room.
   *
   * @param {Request} request
   * @returns {Object}
   */
  join (request) {
    const roomId = request.input.body.roomId;

    if (!this.rooms[roomId]) {
      throw new NotFoundError(`The room id "${roomId}" does not exist`);
    }

    const response = this._subscribeToRoom(roomId, request);
    this.kuzzle.pluginsManager.trigger('core:hotelClerk:join', response);
    return response.data;
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
      dslIndex = this.kuzzle.dsl.storage.filtersIndex;

    for (const index of Object.keys(dslIndex)) {
      for (const collection of Object.keys(dslIndex[index])) {
        const isAllowedRequest = new Request({
          controller: 'document',
          action: 'search',
          index,
          collection
        }, request.context);

        promises.push(request.context.user.isActionAllowed(isAllowedRequest, this.kuzzle)
          .then(isAllowed => {
            if (!isAllowed) {
              return;
            }

            if (!list[index]) {
              list[index] = {};
            }
            if (!list[index][collection]) {
              list[index][collection] = {};
            }

            for (const roomId of dslIndex[index][collection]) {
              const room = this.rooms[roomId];
              // the room may be currently registering in the dsl and not ready in the hotel clerk
              // or already deleted in from the hotel clerk and still in the dsl
              if (room) {
                list[index][collection][roomId] = room.customers.size;
              }
            }
          }));
      }
    }

    return Bluebird.all(promises)
      .then(() => list);
  }

  /**
   * This function will delete a user from this.customers, and
   * decrement the subscribers count in all rooms where he has subscribed to
   * Call the cleanUpRooms function to manage empty rooms
   * Usually called on a user disconnection event
   *
   * @param {RequestContext} requestContext
   */
  removeCustomerFromAllRooms (requestContext) {
    if (!this.customers[requestContext.connectionId]) {
      // No need to raise an error if the connection has already been cleaned up
      return;
    }

    for (const roomId of Object.keys(this.customers[requestContext.connectionId])) {
      try {
        this._removeRoomForCustomer(requestContext, roomId);
      }
      catch (err) {
        this.kuzzle.pluginsManager.trigger('log:error', err);
      }
    }
  }

  /**
   * Remove rooms for a given collection
   * If rooms attribute is not provided, all rooms for the collection are removed
   * @param {Request} request
   * @return {Promise<Object>}
   */
  removeRooms (request) {
    if (!this.kuzzle.dsl.exists(request.input.resource.index, request.input.resource.collection)) {
      throw new NotFoundError(`No subscription found on index ${request.input.resource.index} and collection ${request.input.resource.collection}`);
    }

    if (request.input.body && request.input.body.rooms) {
      if (!Array.isArray(request.input.body.rooms)) {
        throw new BadRequestError('The rooms attribute must be an array');
      }

      const
        {
          index,
          collection
        } = request.input.resource,
        rooms = request.input.body.rooms,
        partialErrors = this._removeListRoomsInCollection(index, collection, rooms);

      return {acknowledged: true, partialErrors};
    }

    this._removeAllRoomsInCollection(request.input.resource.index, request.input.resource.collection);
    return {acknowledged: true};
  }

  /**
   * Remove the connection.id from the room and delete it if there is no subscriber left in it
   *
   * @param {Request} request
   */
  removeSubscription (request) {
    // Remove the room for the customer, don't wait for deletion before continuing
    this._removeRoomForCustomer(request.context, request.input.body.roomId);
    return request.input.body.roomId;
  }

  /**
   * Associate the room to the connectionId in this.clients
   * Allow to manage later disconnection and delete socket/rooms/...
   *
   * @param {Request} request
   * @param {string} roomId
   * @param {object} volatile
   */
  _addRoomForCustomer (request, roomId, volatile) {
    if (!this.customers[request.context.connectionId]) {
      this.customers[request.context.connectionId] = {};
    }


    this.rooms[roomId].customers.add(request.context.connectionId);
    this.customers[request.context.connectionId][roomId] = volatile;
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
    let
      diff,
      formattedFilters,
      roomId;

    if (!index || !collection) {
      return Bluebird.reject(new BadRequestError('Cannot subscribe without an index and a collection'));
    }

    return this.kuzzle.dsl.register(index, collection, filters)
      .then(response => {
        roomId = response.id;
        diff = response.diff;
        formattedFilters = response.filter;

        if (!diff && this.rooms[roomId]) {
          return {diff, roomId};
        }

        return this.kuzzle.pluginsManager.trigger('room:new', {
          roomId,
          index,
          collection,
          formattedFilters
        })
        .then(modified => {
          this.rooms[modified.roomId] = {
            id: modified.roomId,
            customers: new Set(),
            index: modified.index,
            channels: {},
            collection: modified.collection
          };

          return {diff, roomId};
        });
      });
  }

  /**
   * Remove all rooms for provided collection
   * Will remove room from the DSL, from the rooms list and for each customers.
   *
   * @this HotelClerk
   * @param index
   * @param collection
   */
  _removeAllRoomsInCollection (index, collection) {
    // we need a copy of the array as it will be progressively be destroyed
    const dslFilters = [].concat(this.kuzzle.dsl.getFilterIds(index, collection));

    for (const roomId of dslFilters) {
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
    for (const connectionId of Object.keys(this.customers)) {
      for (const customerRoomId of Object.keys(this.customers[connectionId])) {
        if (customerRoomId === roomId) {
          delete this.customers[connectionId][customerRoomId];
        }
      }
    }
  }

  /**
   * Remove a room everywhere: in customers, in the DSL and in this.rooms
   * Allow to delete a room with action admin/removeRooms or admin/removeRooms
   *
   * @this HotelClerk
   * @param roomId
   */
  _removeRoomEverywhere (roomId) {
    this._removeRoomForAllCustomers(roomId);

    const room = this.rooms[roomId];

    if (!room) {
      // room is not registered. Nothing to do but warn in case of
      this.kuzzle.pluginsManager.trigger('log:warn', `hotelClerk._removeRoomEveryWhere could not find room ${roomId}`);
      return;
    }

    delete this.rooms[roomId];
    this._removeRoomFromDsl(roomId);
  }

  /**
   * Remove the room from subscribed room from the user
   * Return the roomId in user mapping
   *
   * @this HotelClerk
   * @param {RequestContext} requestContext
   * @param {string} roomId
   * @param {Boolean} [notify]
   * @return {String}
   */
  _removeRoomForCustomer (requestContext, roomId, notify = true) {
    const room = this.rooms[roomId];

    if (notify) {
      this.kuzzle.pluginsManager.trigger('core:hotelClerk:removeRoomForCustomer', {requestContext, roomId});
    }

    let volatile = null;
    if (this.customers[requestContext.connectionId] && this.customers[requestContext.connectionId][roomId] !== undefined) {
      volatile = this.customers[requestContext.connectionId][roomId];
      if (Object.keys(this.customers[requestContext.connectionId]).length > 1) {
        delete this.customers[requestContext.connectionId][roomId];
      }
      else {
        delete this.customers[requestContext.connectionId];
      }
    }

    if (room === undefined) {
      throw new NotFoundError(`The room id ${roomId} does not exist`);
    }
    room.customers.delete(requestContext.connectionId);

    for (const channel of Object.keys(this.rooms[roomId].channels)) {
      this.kuzzle.entryPoints.proxy.leaveChannel({channel, connectionId: requestContext.connectionId});
      this.kuzzle.pluginsManager.trigger('proxy:leaveChannel', {channel, connectionId: requestContext.connectionId});
    }

    if (room.customers.size === 0) {
      delete this.rooms[roomId];
      this._removeRoomFromDsl(roomId);
    }

    {
      const count = room.customers.size;

      if (count > 0) {
        const request = new Request({
          controller: 'realtime',
          action: 'unsubscribe',
          index: room.index,
          collection: room.collection,
          volatile
        }, requestContext);

        this.kuzzle.notifier.notify([roomId], request, {count});
      }

      return roomId;
    }
  }

  /**
   * Delete room if no user has subscribed to it, and remove it also from the DSL
   *
   * @this HotelClerk
   * @param {string} roomId
   */
  _removeRoomFromDsl (roomId) {
    this.kuzzle.pluginsManager.trigger('room:remove', roomId);
    this.kuzzle.dsl.remove(roomId);
  }

  /**
   * subscribe the user to an existing room.
   *
   * @this HotelClerk
   * @param {string} roomId
   * @param {Request} request
   * @returns {Object}
   */
  _subscribeToRoom (roomId, request) {
    const channel = this._createChannelConfiguration(request);

    let changed = false;
    const
      channelName = `${roomId}-${this.kuzzle.constructor.hash(channel)}`,
      diff = {hcR: {
        i: request.input.resource.index,
        c: request.input.resource.collection,
        ch: [ channelName, channel ],
        r: roomId,
        cx: {i: request.context.connectionId, p: request.context.protocol},
        m: request.input.volatile
      }};

    if (!this.customers[request.context.connectionId] || this.customers[request.context.connectionId][roomId] === undefined) {
      changed = true;
      this._addRoomForCustomer(request, roomId, request.input.volatile);
      this.kuzzle.notifier.notify([roomId], request, {count: this.rooms[roomId].customers.length});
    }

    this.kuzzle.entryPoints.proxy.joinChannel({channel: channelName, connectionId: request.context.connectionId});
    this.kuzzle.pluginsManager.trigger('proxy:joinChannel', {channel: channelName, connectionId: request.context.connectionId});
    if (!this.rooms[roomId].channels[channelName]) {
      changed = true;
      this.rooms[roomId].channels[channelName] = channel;
    }

    return {diff: changed && diff, data: {roomId, channel: channelName}};
  }
}

module.exports = HotelClerk;
