var
  _ = require('lodash'),
  async = require('async'),
  Promise = require('bluebird'),
  crypto = require('crypto'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  InternalError = require('kuzzle-common-objects').Errors.internalError;

/**
 *
 * @param kuzzle
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
   *        // metadata for this customer's subscription on that room
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
   * @param {RequestObject} requestObject
   * @param {Object} context
   *
   * @return {Promise} promise. Return a NotificationObject on success. Reject with error if the
   * user has already subscribed to this room name (just for rooms with same name, there is no error
   * if the room has a different name with same filter) or if there is an error during room creation
   */
  this.addSubscription = function (requestObject, context) {
    var diff = [];

    return createRoom.call(this, requestObject.index, requestObject.collection, requestObject.data.body)
      .then(response => {
        if (response.diff) {
          diff = response.diff;
        }
        return subscribeToRoom.call(this, response.roomId, requestObject, context);
      })
      .then(response => {
        if (response.diff) {
          diff = diff.concat(response.diff);
          kuzzle.pluginsManager.trigger('core:hotelClerk:addSubscription', diff);
        }

        return response.data;
      });
  };

  /**
   * Returns the list of existing channels on a given room, depending of the response object
   *
   * @param roomId
   * @param notification
   * @return {Array} list of channels
   */
  this.getChannels = function (roomId, notification) {
    var channels = [];

    if (this.rooms[roomId]) {
      Object.keys(this.rooms[roomId].channels).forEach(channel => {
        var
          c = this.rooms[roomId].channels[channel],
          stateMatch = c.state === 'all' || !notification.state || notification.action === 'publish' || c.state === notification.state,
          scopeMatch = c.scope === 'all' || !notification.scope || c.scope === notification.scope,
          usersMatch = c.users === 'all' || notification.controller !== 'subscribe' ||
            c.users === 'in' && notification.action === 'on' || c.users === 'out' && notification.action === 'off';

        if (stateMatch && scopeMatch && usersMatch) {
          channels.push(channel);
        }
      });
    }

    return channels;
  };

  /**
   * Remove the connection.id from the room and delete it if there is no subscriber left in it
   *
   * @param {RequestObject} requestObject
   * @param {Object} context
   *
   * @returns {Promise} promise
   */
  this.removeSubscription = function (requestObject, context) {
    var
      connection = context.connection;

    if (!requestObject.data.body || !requestObject.data.body.roomId) {
      return Promise.reject(new BadRequestError('The room ID is mandatory to unsubcribe to a room'));
    }

    // Remove the room for the customer, don't wait for deletion before continuing
    return removeRoomForCustomer.call(this, connection, requestObject.data.body.roomId)
      .then(roomId => ({roomId}));
  };

  /**
   * Return the subscribers count on a given room
   *
   * @param {RequestObject} requestObject
   *
   * @returns {Promise} promise
   */
  this.countSubscription = function (requestObject) {
    if (!requestObject.data.body || !requestObject.data.body.roomId) {
      return Promise.reject(new BadRequestError('The room Id is mandatory to count subscriptions'));
    }

    if (!this.rooms[requestObject.data.body.roomId]) {
      return Promise.reject(new NotFoundError('The room Id ' + requestObject.data.body.roomId + ' does not exist'));
    }

    return Promise.resolve({count: this.rooms[requestObject.data.body.roomId].customers.length});
  };

  /**
   * This function will delete a user from this.customers, and
   * decrement the subscribers count in all rooms where he has subscribed to
   * Call the cleanUpRooms function to manage empty rooms
   * Usually called on a user disconnection event
   *
   * @param {Object} connection information
   * @returns {Promise}
   */
  this.removeCustomerFromAllRooms = function (connection) {
    var
      rooms;

    if (!this.customers[connection.id]) {
      // No need to raise an error if the connection has already been cleaned up
      return Promise.resolve();
    }

    rooms = Object.keys(this.customers[connection.id]);

    return new Promise((resolve, reject) => {
      async.each(rooms, (roomId, callback) => {
        removeRoomForCustomer.call(this, connection, roomId).asCallback(callback);
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
   * @param {object} context
   * @returns {Promise} resolve an object with collection, rooms, subscribers
   */
  this.listSubscriptions = function (context) {
    return new Promise(resolve => {
      var
        list = {},
        requestObjectCollection = {
          action: 'search',
          controller: 'read'
        };

      async.each(Object.keys(this.rooms), (roomId, callback) => {
        var room = this.rooms[roomId];

        kuzzle.repositories.user.load(context.token.userId)
          .then(user => {
            var requestObject = _.assign(requestObjectCollection, {index: room.index, collection: room.collection});

            return user.isActionAllowed(requestObject, context, kuzzle);
          })
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
   * @param {RequestObject} requestObject
   * @param {Object} context
   * @returns {Promise}
   */
  this.join = function (requestObject, context) {
    var
      roomId = requestObject.data.body.roomId;

    if (!this.rooms[roomId]) {
      return Promise.reject(new InternalError('No room found for id ' + roomId));
    }

    return Promise.resolve(subscribeToRoom.call(this, roomId, requestObject, context))
      .then(response => {
        kuzzle.pluginsManager.trigger('core:hotelClerk:join', response);
        return response.data;
      });
  };

  /**
   * Remove rooms for a given collection
   * If rooms attribute is not provided, all rooms for the collection are removed
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.removeRooms = function (requestObject) {
    if (!requestObject.index) {
      return Promise.reject(new BadRequestError('No index provided'));
    }

    if (!requestObject.collection) {
      return Promise.reject(new BadRequestError('No collection provided'));
    }

    if (!kuzzle.dsl.exists(requestObject.index, requestObject.collection)) {
      return Promise.reject(new NotFoundError(`No subscription found on index ${requestObject.index} and collection ${requestObject.collection}`));
    }

    if (requestObject.data && requestObject.data.body && requestObject.data.body.rooms) {
      if (!Array.isArray(requestObject.data.body.rooms)) {
        return Promise.reject(new BadRequestError('The rooms attribute must be an array'));
      }

      return removeListRoomsInCollection.call(this, requestObject.index, requestObject.collection, requestObject.data.body.rooms)
        .then((partialErrors) => ({acknowledge: true, partialErrors}));
    }

    return removeAllRoomsInCollection.call(this, requestObject.index, requestObject.collection)
      .then(() => ({acknowledge: true}));
  };

  /**
   * Returns an unique list of subscribed collections
   *
   * @returns {Array}
   */
  this.getRealtimeCollections = function () {
    var collections = [];

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
 * @param index
 * @param collection
 * @returns {Promise} resolve nothing
 */
function removeAllRoomsInCollection (index, collection) {
  var
    dslFilters = this.kuzzle.dsl.getFilterIds(index, collection);

  return new Promise((resolve, reject) => {
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
 * @param {String} index
 * @param {String} collection
 * @param {String[]} rooms
 * @returns {Promise}
 */
function removeListRoomsInCollection (index, collection, rooms) {
  var
    partialErrors = [];

  return new Promise((resolve, reject) => {
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
 * @param {String} index
 * @param {String} collection
 * @param {Object} filters
 * @returns {Promise} promise
 */
function createRoom (index, collection, filters) {
  var
    diff,
    roomId;

  if (!index || !collection) {
    return Promise.reject(new BadRequestError('Cannot subscribe without an index and a collection'));
  }

  roomId = this.kuzzle.dsl.createFilterId(index, collection, filters);

  return Promise.fromNode(asyncCB => async.retry(callback => {
    // if the room is about to be destroyed, we have to delay its re-creation until its destruction has completed
    if (this.rooms[roomId] && this.rooms[roomId].destroyed) {
      return callback(new InternalError('Cannot create the room ' + roomId + ' because it has been marked for destruction'));
    }

    if (!this.rooms[roomId]) {
      // If it's a new room, we have to calculate filters to apply on the future documents
      this.kuzzle.dsl.register(roomId, index, collection, filters)
        .then(response => {
          var formattedFilters;

          if (response && response.filter !== undefined) {
            formattedFilters = response.filter;
          }

          if (response) {
            diff = response.diff;
          }

          if (this.rooms[roomId]) {
            return callback(null, roomId);
          }

          this.kuzzle.pluginsManager.trigger('room:new', {
            roomId: roomId,
            index: index,
            collection: collection,
            formattedFilters: formattedFilters
          })
            .then(modifiedData => {
              this.rooms[modifiedData.roomId] = {
                id: modifiedData.roomId,
                customers: [],
                index: modifiedData.index,
                channels: {},
                collection: modifiedData.collection
              };

              callback(null, {diff, roomId});
            });
        })
        .catch(error => callback(error));
    }
    else {
      callback(null, {roomId});
    }
  }, asyncCB));
}

/**
 * Associate the room to the connectionId in this.clients
 * Allow to manage later disconnection and delete socket/rooms/...
 *
 * @this HotelClerk
 * @param {Object} connection
 * @param {String} roomId
 * @param {Object} metadata
 */
function addRoomForCustomer (connection, roomId, metadata) {
  if (!this.customers[connection.id]) {
    this.customers[connection.id] = {};
  }

  this.rooms[roomId].customers.push(connection.id);
  this.customers[connection.id][roomId] = metadata;
}

/**
 * Create a channel object and resolve it
 *
 * @param requestObject
 * @return {Promise}
 */
function createChannelConfiguration (requestObject) {
  var
    channel = {};

  if (requestObject.state && ['all', 'done', 'pending'].indexOf(requestObject.state) === -1) {
    return Promise.reject(new BadRequestError('Incorrect value for the "state" parameter. Expected: all, done or pending. Got: ' + requestObject.state));
  } else if (!requestObject.state) {
    channel.state = 'done';
  } else {
    channel.state = requestObject.state;
  }

  if (requestObject.scope && ['all', 'in', 'out', 'none'].indexOf(requestObject.scope) === -1) {
    return Promise.reject(new BadRequestError('Incorrect value for the "scope" parameter. Expected: all, in, out or none. Got: ' + requestObject.scope));
  } else if (!requestObject.scope) {
    channel.scope = 'all';
  } else {
    channel.scope = requestObject.scope;
  }

  if (requestObject.users && ['all', 'in', 'out', 'none'].indexOf(requestObject.users) === -1) {
    return Promise.reject(new BadRequestError('Incorrect value for the "users" parameter. Expected: all, in, out or none. Got: ' + requestObject.users));
  } else if (!requestObject.users) {
    channel.users = 'none';
  } else {
    channel.users = requestObject.users;
  }

  return Promise.resolve(channel);
}

/**
 * Delete room if no user has subscribed to it, and remove it also from the DSL
 *
 * @this HotelClerk
 * @param roomId
 * @returns {Promise}
 */
function cleanUpRooms (roomId) {
  if (this.rooms[roomId].customers.length === 0 && !this.rooms[roomId].destroyed) {
    /*
     This flag ensures that a room is destroyed only once.
     Multiple room cleanup might happen when different users unsubscribe at the same time, and trying
     to destroy the same room multiple times lead to unpredictable results
     */
    this.rooms[roomId].destroyed = true;

    return this.kuzzle.dsl.remove(roomId)
      .then(() => {
        this.kuzzle.pluginsManager.trigger('room:remove', roomId);
        return roomId;
      })
      .catch(error => {
        this.kuzzle.pluginsManager.trigger('log:error', error);
        return Promise.reject(error);
      })
      .finally(() => delete this.rooms[roomId]);
  }

  return Promise.resolve(roomId);
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
 * @param {Object} connection
 * @param {String} roomId
 * @return {Promise} promise
 */
function removeRoomForCustomer (connection, roomId, notify) {
  if (notify === undefined) {
    notify = true;
  }

  if (notify) {
    this.kuzzle.pluginsManager.trigger('core:hotelClerk:removeRoomForCustomer', {connection, roomId});
  }

  if (!this.customers[connection.id]) {
    return Promise.reject(new NotFoundError(`The user with connection ${connection.id} doesn't exist`));
  }

  if (!this.customers[connection.id][roomId]) {
    return Promise.reject(new NotFoundError(`The user with connectionId ${connection.id} doesn't listen the room ${roomId}`));
  }

  Object.keys(this.rooms[roomId].channels).forEach(channel => {
    this.kuzzle.entryPoints.proxy.leaveChannel({channel, id: connection.id});
    this.kuzzle.pluginsManager.trigger('protocol:leaveChannel', {channel, id: connection.id});
  });

  this.rooms[roomId].customers.splice(this.rooms[roomId].customers.indexOf(connection.id), 1);

  return cleanUpRooms.call(this, roomId)
    .then(() => {
      var
        count = this.rooms[roomId] ? this.rooms[roomId].customers.length : 0,
        requestObject;

      if (count > 0) {
        requestObject = new RequestObject({
          controller: 'subscribe',
          action: 'off',
          index: this.rooms[roomId].index,
          collection: this.rooms[roomId].collection,
          metadata: this.customers[connection.id][roomId]
        }, null, connection.type);


        this.kuzzle.notifier.notify(roomId, requestObject, {count});
      }

      if (Object.keys(this.customers[connection.id]).length > 1) {
        delete this.customers[connection.id][roomId];
      } else {
        delete this.customers[connection.id];
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

  return Promise.resolve();
}

/** MANAGE FILTERS TREE **/

/**
 * subscribe the user to an existing room.
 *
 * @this HotelClerk
 * @param {String} roomId
 * @param {RequestObject} requestObject
 * @param {Object} context
 * @returns {NotificationObject}
 */
function subscribeToRoom (roomId, requestObject, context) {
  var
    connection = context.connection;

  return createChannelConfiguration(requestObject)
    .then(channel => {
      var
        changed = false,
        channelName = roomId + '-' + crypto.createHash('md5').update(JSON.stringify(channel)).digest('hex'),
        diff = {hcR: {
          i: requestObject.index,
          c: requestObject.collection,
          ch: [ channelName, channel ],
          r: roomId,
          cx: connection,
          m: requestObject.metadata
        }};

      if (!this.customers[connection.id] || !this.customers[connection.id][roomId]) {
        changed = true;
        addRoomForCustomer.call(this, connection, roomId, requestObject.metadata);
        this.kuzzle.notifier.notify(roomId, requestObject, {count: this.rooms[roomId].customers.length});
      }

      this.kuzzle.entryPoints.proxy.joinChannel({channel: channelName, id: connection.id});
      this.kuzzle.pluginsManager.trigger('protocol:joinChannel', {channel: channelName, id: connection.id});
      if (!this.rooms[roomId].channels[channelName]) {
        changed = true;
        this.rooms[roomId].channels[channelName] = channel;
      }

      return {diff: changed && diff, data: {roomId, channel: channelName}};
    });
}

module.exports = HotelClerk;
