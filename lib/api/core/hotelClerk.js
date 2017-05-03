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
  _ = require('lodash'),
  async = require('async'),
  Bluebird = require('bluebird'),
  highwayhash = require('highwayhash'),
  Request = require('kuzzle-common-objects').Request,
  {
    BadRequestError,
    NotFoundError,
    InternalError: KuzzleInternalError
  } = require('kuzzle-common-objects').errors;

/**
 *
 * @global JSON
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function HotelClerk (kuzzle) {
  this.kuzzle = kuzzle;
  /**
   * A simple list of rooms, containing their associated filter and how many users have subscribed to it
   *
   * Example: subscribing to a chat room where the subject is Kuzzle
   *  rooms = {
   *    'f45de4d8ef4f3ze4ffzer85d4fgkzm41' : { // -> the room unique ID (=== the filter unique ID)
   *      customers: [ 'connectionId' ], // -> list of users subscribing to this room
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
  this.addSubscription = function hotelClerkAddSubscription (request) {
    const diff = [];

    return createRoom.call(this, request.input.resource.index, request.input.resource.collection, request.input.body)
      .then(response => {
        if (response.diff) {
          diff.push(response.diff);
        }

        return subscribeToRoom.call(this, response.roomId, request);
      })
      .then(response => {
        if (response.diff) {
          diff.push(response.diff);
          kuzzle.pluginsManager.trigger('core:hotelClerk:addSubscription', diff);
        }

        return response.data;
      });
  };

  /**
   * Returns the list of existing channels on a given room, depending of the response object
   *
   * @param {Array} channels - channels array to amend
   * @param {string} roomId
   * @param {object} notification object
   */
  this.addToChannels = function hotelClerkAddToChannels (channels, roomId, notification) {
    if (this.rooms[roomId]) {
      Object.keys(this.rooms[roomId].channels).forEach(channel => {
        const
          c = this.rooms[roomId].channels[channel],
          stateMatch = c.state === 'all' || !notification.state || notification.action === 'publish' || c.state === notification.state,
          scopeMatch = c.scope === 'all' || !notification.scope || c.scope === notification.scope,
          usersMatch = c.users === 'all' || notification.getUserFlag() === 'none' || c.users === notification.getUserFlag();

        if (stateMatch && scopeMatch && usersMatch) {
          channels.push(channel);
        }
      });
    }
  };

  /**
   * Remove the connection.id from the room and delete it if there is no subscriber left in it
   *
   * @param {Request} request
   * @returns {Promise} promise
   */
  this.removeSubscription = function hotelClerkRemoveSubscription (request) {
    // Remove the room for the customer, don't wait for deletion before continuing
    return removeRoomForCustomer.call(this, request.context, request.input.body.roomId)
      .then(roomId => ({roomId}));
  };

  /**
   * Return the subscribers count on a given room
   *
   * @param {Request} request
   * @returns {Promise} promise
   */
  this.countSubscription = function hotelClerkCountSubscription (request) {
    if (!this.rooms[request.input.body.roomId]) {
      return Bluebird.reject(new NotFoundError(`The room Id "${request.input.body.roomId}" does not exist`));
    }

    return Bluebird.resolve({count: this.rooms[request.input.body.roomId].customers.length});
  };

  /**
   * This function will delete a user from this.customers, and
   * decrement the subscribers count in all rooms where he has subscribed to
   * Call the cleanUpRooms function to manage empty rooms
   * Usually called on a user disconnection event
   *
   * @param {RequestContext} requestContext
   * @returns {Promise}
   */
  this.removeCustomerFromAllRooms = function hotelClerkRemoveCustormerFromAllRooms (requestContext) {
    if (!this.customers[requestContext.connectionId]) {
      // No need to raise an error if the connection has already been cleaned up
      return Bluebird.resolve();
    }

    const rooms = Object.keys(this.customers[requestContext.connectionId]);

    return new Bluebird((resolve, reject) => {
      async.each(rooms, (roomId, callback) => {
        removeRoomForCustomer.call(this, requestContext, roomId).asCallback(callback);
      }, err => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });
  };

  /**
   * Return all rooms for all filters for all collections
   * with for each rooms the total number of subscribers
   *
   * @param {Request} request
   * @returns {Promise} resolve an object with collection, rooms, subscribers
   */
  this.listSubscriptions = function hotelClerkListSubscriptions (request) {
    return new Bluebird(resolve => {
      const list = {};

      async.each(Object.keys(this.rooms), (roomId, callback) => {
        const
          room = this.rooms[roomId],
          rightRequest = new Request({
            action: 'search',
            controller: 'document',
            index: room.index,
            collection: room.collection
          }, request.context);

        return request.context.user.isActionAllowed(rightRequest, kuzzle)
          .then(isAllowed => {
            if (!isAllowed) {
              return callback(null);
            }

            if (!list[room.index]) {
              list[room.index] = {};
            }

            if (!list[room.index][room.collection]) {
              list[room.index][room.collection] = {};
            }

            list[room.index][room.collection][roomId] = room.customers.length;
            callback(null);
          });
      }, () => resolve(list));
    });
  };

  /**
   * Joins an existing room.
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.join = function hotelClerkJoin (request) {
    const roomId = request.input.body.roomId;

    if (!this.rooms[roomId]) {
      return Bluebird.reject(new NotFoundError('No room found for id ' + roomId));
    }

    return Bluebird.resolve(subscribeToRoom.call(this, roomId, request))
      .then(response => {
        kuzzle.pluginsManager.trigger('core:hotelClerk:join', response);
        return response.data;
      });
  };

  /**
   * Remove rooms for a given collection
   * If rooms attribute is not provided, all rooms for the collection are removed
   * @param {Request} request
   * @returns {Promise}
   */
  this.removeRooms = function hotelClerkRemoveRooms (request) {
    if (!kuzzle.dsl.exists(request.input.resource.index, request.input.resource.collection)) {
      return Bluebird.reject(new NotFoundError(`No subscription found on index ${request.input.resource.index} and collection ${request.input.resource.collection}`));
    }

    if (request.input.body && request.input.body.rooms) {
      if (!Array.isArray(request.input.body.rooms)) {
        return Bluebird.reject(new BadRequestError('The rooms attribute must be an array'));
      }

      return removeListRoomsInCollection.call(this, request.input.resource.index, request.input.resource.collection, request.input.body.rooms)
        .then(partialErrors => ({acknowledge: true, partialErrors}));
    }

    return removeAllRoomsInCollection.call(this, request.input.resource.index, request.input.resource.collection)
      .then(() => ({acknowledge: true}));
  };

  /**
   * Returns an unique list of subscribed collections
   *
   * @returns {Array}
   */
  this.getRealtimeCollections = function hotelClerkGetRealtimeCollections () {
    const collections = [];

    Object.keys(this.rooms).forEach(room => {
      collections.push({name: this.rooms[room].collection, index: this.rooms[room].index});
    });

    return _.uniqWith(collections, _.isEqual);
  };


  // pseudo private methods.
  Object.defineProperties(this, {
    addRoomForCustomer: {
      value: addRoomForCustomer.bind(this)
    },
    removeRoomForCustomer: {
      value: removeRoomForCustomer.bind(this)
    }
  });

}

/** MANAGE ROOMS **/

/**
 * Remove all rooms for provided collection
 * Will remove room from the DSL, from the rooms list and for each customers.
 *
 * @this HotelClerk
 * @param index
 * @param collection
 * @returns {Promise} resolve nothing
 */
function removeAllRoomsInCollection (index, collection) {
  const dslFilters = this.kuzzle.dsl.getFilterIds(index, collection);

  return new Bluebird((resolve, reject) => {
    async.each(dslFilters, (id, cb) => removeRoomEverywhere.call(this, id).asCallback(cb), err => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * @this HotelClerk
 * @param {string} index
 * @param {string} collection
 * @param {String[]} rooms
 * @returns {Promise}
 */
function removeListRoomsInCollection (index, collection, rooms) {
  const partialErrors = [];

  return new Bluebird(resolve => {
    async.each(rooms, (roomId, callback) => {
      if (!this.rooms[roomId]) {
        // don't stop the loop if error occured but return a partial error to user
        partialErrors.push(`No room with id ${roomId}`);
        return callback();
      }

      if (this.rooms[roomId].index !== index) {
        // don't stop the loop if error occured but return a partial error to user
        partialErrors.push(`The room ${roomId} does not match index ${index}`);
        return callback();
      }

      if (this.rooms[roomId].collection !== collection) {
        // don't stop the loop if error occured but return a partial error to user
        partialErrors.push(`The room ${roomId} does not match collection ${collection}`);
        return callback();
      }

      removeRoomEverywhere.call(this, roomId).asCallback(callback);
    }, () => resolve(partialErrors));
  });
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
function createRoom (index, collection, filters) {
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

      if (!diff && this.rooms[roomId] && !this.rooms[roomId].destroyed) {
        return {diff, roomId};
      }

      return Bluebird.fromNode(asyncCB => async.retry(callback => {
        // if the room is about to be destroyed, we have to delay its re-registration until its destruction has completed
        if (this.rooms[roomId] && this.rooms[roomId].destroyed) {
          return callback(new KuzzleInternalError(`Cannot create the room ${roomId} because it has been marked for destruction`));
        }
        callback(null, {roomId});
      }, asyncCB))
        .then(() => {
          return this.kuzzle.pluginsManager.trigger('room:new', {
            roomId,
            index,
            collection,
            formattedFilters
          });
        })
        .then(modifiedData => {
          this.rooms[modifiedData.roomId] = {
            id: modifiedData.roomId,
            customers: [],
            index: modifiedData.index,
            channels: {},
            collection: modifiedData.collection
          };

          return {diff, roomId};
        });
    });
}

/**
 * Associate the room to the connectionId in this.clients
 * Allow to manage later disconnection and delete socket/rooms/...
 *
 * @this HotelClerk
 * @param {Request} request
 * @param {string} roomId
 * @param {object} volatile
 */
function addRoomForCustomer (request, roomId, volatile) {
  if (!this.customers[request.context.connectionId]) {
    this.customers[request.context.connectionId] = {};
  }

  this.rooms[roomId].customers.push(request.context.connectionId);
  this.customers[request.context.connectionId][roomId] = volatile;
}

/**
 * Create a channel object and resolve it
 *
 * @param {Request} request
 * @return {Promise<NotificationObject>}
 */
function createChannelConfiguration (request) {
  const channel = {};

  if (request.input.args.state && ['all', 'done', 'pending'].indexOf(request.input.args.state) === -1) {
    return Bluebird.reject(new BadRequestError('Incorrect value for the "state" parameter. Expected: all, done or pending. Got: ' + request.input.args.state));
  } else if (!request.input.args.state) {
    channel.state = 'done';
  } else {
    channel.state = request.input.args.state;
  }

  if (request.input.args.scope && ['all', 'in', 'out', 'none'].indexOf(request.input.args.scope) === -1) {
    return Bluebird.reject(new BadRequestError('Incorrect value for the "scope" parameter. Expected: all, in, out or none. Got: ' + request.input.args.scope));
  } else if (!request.input.args.scope) {
    channel.scope = 'all';
  } else {
    channel.scope = request.input.args.scope;
  }

  if (request.input.args.users && ['all', 'in', 'out', 'none'].indexOf(request.input.args.users) === -1) {
    return Bluebird.reject(new BadRequestError('Incorrect value for the "users" parameter. Expected: all, in, out or none. Got: ' + request.input.args.users));
  } else if (!request.input.args.users) {
    channel.users = 'none';
  } else {
    channel.users = request.input.args.users;
  }

  return Bluebird.resolve(channel);
}

/**
 * Delete room if no user has subscribed to it, and remove it also from the DSL
 *
 * @this HotelClerk
 * @param roomId
 * @returns {Promise<string>}
 */
function cleanUpRooms (roomId) {
  if (this.rooms[roomId].customers.length === 0 && !this.rooms[roomId].destroyed) {
    /*
     This flag ensures that a room is destroyed only once.
     Multiple room cleanup might happen when different users unsubscribe at the same time, and trying
     to destroy the same room multiple times lead to unpredictable results
     */
    this.rooms[roomId].destroyed = true;

    this.kuzzle.pluginsManager.trigger('room:remove', roomId);
    return this.kuzzle.dsl.remove(roomId)
      .then(() => roomId)
      .catch(error => {
        this.kuzzle.pluginsManager.trigger('log:error', error);
        return Bluebird.reject(error);
      })
      .finally(() => delete this.rooms[roomId]);
  }

  return Bluebird.resolve(roomId);
}

/**
 * Remove a room everywhere: in customers, in the DSL and in this.rooms
 * Allow to delete a room with action admin/removeRooms or admin/removeRooms
 *
 * @this HotelClerk
 * @param roomId
 */
function removeRoomEverywhere (roomId) {
  return removeRoomForAllCustomers.call(this, roomId)
    .then(() => {
      this.rooms[roomId].customers = [];
      return cleanUpRooms.call(this, roomId);
    });
}

/** MANAGE CUSTOMERS **/

/**
 * Remove the room from subscribed room from the user
 * Return the roomId in user mapping
 *
 * @this HotelClerk
 * @param {RequestContext} requestContext
 * @param {string} roomId
 * @param {Boolean} [notify]
 * @return {Promise<string>} promise
 */
function removeRoomForCustomer (requestContext, roomId, notify = true) {
  if (notify) {
    this.kuzzle.pluginsManager.trigger('core:hotelClerk:removeRoomForCustomer', {requestContext, roomId});
  }

  if (!this.customers[requestContext.connectionId]) {
    return Bluebird.reject(new NotFoundError(`The user with connection ${requestContext.connectionId} doesn't exist`));
  }

  if (this.customers[requestContext.connectionId][roomId] === undefined) {
    return Bluebird.reject(new NotFoundError(`The user with connectionId ${requestContext.connectionId} doesn't listen the room ${roomId}`));
  }

  Object.keys(this.rooms[roomId].channels).forEach(channel => {
    this.kuzzle.entryPoints.proxy.leaveChannel({channel, connectionId: requestContext.connectionId});
    this.kuzzle.pluginsManager.trigger('proxy:leaveChannel', {channel, connectionId: requestContext.connectionId});
  });

  this.rooms[roomId].customers.splice(this.rooms[roomId].customers.indexOf(requestContext.connectionId), 1);

  return cleanUpRooms.call(this, roomId)
    .then(() => {
      const count = this.rooms[roomId] ? this.rooms[roomId].customers.length : 0;

      if (count > 0) {
        const request = new Request({
          controller: 'realtime',
          action: 'unsubscribe',
          index: this.rooms[roomId].index,
          collection: this.rooms[roomId].collection,
          volatile: this.customers[requestContext.connectionId][roomId]
        }, requestContext);

        this.kuzzle.notifier.notify([roomId], request, {count});
      }

      if (Object.keys(this.customers[requestContext.connectionId]).length > 1) {
        delete this.customers[requestContext.connectionId][roomId];
      } else {
        delete this.customers[requestContext.connectionId];
      }

      return roomId;
    });
}

/**
 * Remove a roomId for all customers (allow to delete a room everywhere)
 *
 * @this HotelClerk
 * @param roomId
 * @returns {Promise} resolve nothing
 */
function removeRoomForAllCustomers (roomId) {
  Object.keys(this.customers).forEach(customerId => {
    Object.keys(this.customers[customerId]).forEach(customerRoomId => {
      if (customerRoomId === roomId) {
        delete this.customers[customerId][customerRoomId];
      }
    });
  });

  return Bluebird.resolve();
}

/** MANAGE FILTERS TREE **/

/**
 * subscribe the user to an existing room.
 *
 * @this HotelClerk
 * @param {string} roomId
 * @param {Request} request
 * @returns {Promise<Object>}
 */
function subscribeToRoom (roomId, request) {
  return createChannelConfiguration(request)
    .then(channel => {
      let changed = false;
      const
        channelName = roomId + '-' + highwayhash.asHexString(this.kuzzle.hashKey, Buffer.from(JSON.stringify(channel))),
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
        addRoomForCustomer.call(this, request, roomId, request.input.volatile);
        this.kuzzle.notifier.notify([roomId], request, {count: this.rooms[roomId].customers.length});
      }

      this.kuzzle.entryPoints.proxy.joinChannel({channel: channelName, connectionId: request.context.connectionId});
      this.kuzzle.pluginsManager.trigger('proxy:joinChannel', {channel: channelName, connectionId: request.context.connectionId});
      if (!this.rooms[roomId].channels[channelName]) {
        changed = true;
        this.rooms[roomId].channels[channelName] = channel;
      }

      return {diff: changed && diff, data: {roomId, channel: channelName}};
    });
}

module.exports = HotelClerk;
