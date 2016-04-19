var
  _ = require('lodash'),
  async = require('async'),
  q = require('q'),
  stringify = require('json-stable-stringify'),
  RequestObject = require('../core/models/requestObject'),
  RealTimeResponseObject = require('../core/models/realTimeResponseObject'),
  ResponseObject = require('../core/models/responseObject'),
  BadRequestError = require('./errors/badRequestError'),
  NotFoundError = require('./errors/notFoundError'),
  InternalError = require('./errors/internalError'),
  PartialError = require('./errors/partialError'),
  // module to manage md5 hash
  crypto = require('crypto');


module.exports = function HotelClerk (kuzzle) {

  this.kuzzle = kuzzle;
  /**
   * A simple list of rooms, containing their associated filter and how many users have subscribed to it
   *
   * Example: subscribing to a chat room where the subject is Kuzzle
   *  rooms = {
   *    'f45de4d8ef4f3ze4ffzer85d4fgkzm41' : { // -> the room id (according to filters and collection)
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
   *      filters: {
   *        and : {
   *          'message.subject.termSubjectKuzzle': filtersTree.message.subject.termSubjectKuzzle.fn
   *        }
   *      }
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
   * @return {Promise} promise. Return a RealTimeResponseObject on success. Reject with error if the
   * user has already subscribed to this room name (just for rooms with same name, there is no error
   * if the room has a different name with same filter) or if there is an error during room creation
   */
  this.addSubscription = function (requestObject, context) {
    var deferred = q.defer();

    createRoom.call(this, requestObject.index, requestObject.collection, requestObject.data.body)
      .then(roomId => {
        return subscribeToRoom.call(this, roomId, requestObject, context);
      })
      .then(response => deferred.resolve(response))
      .catch(error => deferred.reject(error));

    return deferred.promise;
  };

  /**
   * Returns the list of existing channels on a given room, depending of the response object
   *
   * @param roomId
   * @param responseObject
   * @return {Array} list of channels
   */
  this.getChannels = function (roomId, responseObject) {
    var channels = [];

    if (this.rooms[roomId]) {
      Object.keys(this.rooms[roomId].channels).forEach(channel => {
        var
          c = this.rooms[roomId].channels[channel],
          stateMatch = c.state === 'all' || !responseObject.state || responseObject.action === 'publish' || c.state === responseObject.state,
          scopeMatch = c.scope === 'all' || !responseObject.scope || c.scope === responseObject.scope,
          usersMatch = c.users === 'all' || responseObject.controller !== 'subscribe' ||
            c.users === 'in' && responseObject.action === 'on' || c.users === 'out' && responseObject.action === 'off';

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
      connection = context.connection,
      deferred = q.defer();

    if (!requestObject.data.body || !requestObject.data.body.roomId) {
      deferred.reject(new BadRequestError('The room ID is mandatory to unsubcribe to a room'));
      return deferred.promise;
    }

    // Remove the room for the customer, don't wait for deletion before continuing
    removeRoomForCustomer.call(this, connection, requestObject.data.body.roomId)
      .then(roomId => deferred.resolve(new RealTimeResponseObject(roomId, requestObject)))
      .catch(error => {
        kuzzle.emit('remsub:error', {error: error});
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Return the subscribers count on a given room
   *
   * @param {RequestObject} requestObject
   *
   * @returns {Promise} promise
   */
  this.countSubscription = function (requestObject) {
    var deferred = q.defer();

    if (!requestObject.data.body || !requestObject.data.body.roomId) {
      deferred.reject(new BadRequestError('The room Id is mandatory to count subscriptions'));
      return deferred.promise;
    }

    if (!this.rooms[requestObject.data.body.roomId]) {
      deferred.reject(new NotFoundError('The room Id ' + requestObject.data.body.roomId + ' does not exist'));
      return deferred.promise;
    }

    deferred.resolve(new RealTimeResponseObject(requestObject.data.body.roomId, requestObject, {count: this.rooms[requestObject.data.body.roomId].customers.length}));

    return deferred.promise;
  };

  /**
   * This function will delete a user from this.customers, and
   * decrement the subscribers count in all rooms where he has subscribed to
   * Call the cleanUpRooms function to manage empty rooms
   * Usually called on a user disconnection event
   *
   * @param {Object} connection information
   * @returns {Promise} reject an error or resolve nothing
   */
  this.removeCustomerFromAllRooms = function (connection) {
    var
      deferred = q.defer(),
      rooms;

    if (!this.customers[connection.id]) {
      deferred.reject(new NotFoundError('Unknown user with connection id ' + connection.id));
      return deferred.promise;
    }

    rooms = Object.keys(this.customers[connection.id]);

    async.each(rooms, (roomId, callback) => {
      removeRoomForCustomer.call(this, connection, roomId)
        .then(() => callback())
        .catch(error => callback(error));
    }, (error) => {
      if (error) {
        deferred.reject(error);
      } else {
        deferred.resolve();
      }
    });

    return deferred.promise;
  };


  /**
   * Return all rooms for all filters for all collections
   * with for each rooms the total number of subscribers
   *
   * @param {RequestObject} requestObject
   * @param {object} context
   * @returns {Promise} resolve an object with collection, rooms, subscribers
   */
  this.listSubscriptions = function (requestObject, context) {
    var
      list = {},
      deferred = q.defer();

    var
      requestObjectCollection = {
        action: 'search',
        controller: 'read'
      },
      collectionNotAllowed = [];

    async.each(Object.keys(this.rooms), (roomId, callback) => {
      var room = this.rooms[roomId];

      if (collectionNotAllowed.indexOf(room.index + '.' + room.collection) !== -1) {
        return callback(null);
      }

      requestObjectCollection.index = room.index;
      requestObjectCollection.collection = room.collection;

      if (list[room.index] && list[room.index][room.collection]) {
        list[room.index][room.collection][roomId] = room.customers.length;
        return callback(null);
      }

      context.token.user.profile.isActionAllowed(requestObjectCollection, context, kuzzle.indexCache.indexes)
        .then(isAllowed => {
          if (!isAllowed) {
            collectionNotAllowed.push(room.index + '.' + room.collection);
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
    }, () => {
      deferred.resolve(new ResponseObject(requestObject,list));
    });

    return deferred.promise;
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
      return q.reject(new InternalError('No room found for id ' + roomId));
    }

    return q(subscribeToRoom.call(this, roomId, requestObject, context));
  };

  /**
   * Remove rooms for a given collection
   * If rooms attribute is not provided, all rooms for the collection are removed
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve a response object. May have PartialError if rooms are provided and don't match collection
   */
  this.removeRooms = function (requestObject) {
    var
      responseObject,
      deferred = q.defer();

    if (!requestObject.index) {
      deferred.reject(new BadRequestError('No index provided'));
      return deferred.promise;
    }

    if (!requestObject.collection) {
      deferred.reject(new BadRequestError('No collection provided'));
      return deferred.promise;
    }

    if (!kuzzle.dsl.filtersTree[requestObject.index]) {
      deferred.reject(new NotFoundError('No subscription on this index'));
      return deferred.promise;
    }

    if (!kuzzle.dsl.filtersTree[requestObject.index][requestObject.collection]) {
      deferred.reject(new NotFoundError('No subscription on this collection'));
      return deferred.promise;
    }

    if (requestObject.data && requestObject.data.body && requestObject.data.body.rooms) {
      if (!Array.isArray(requestObject.data.body.rooms)) {
        deferred.reject(new BadRequestError('The rooms attribute must be an array'));
        return deferred.promise;
      }

      removeListRoomsInCollection.call(this, requestObject.index, requestObject.collection, requestObject.data.body.rooms)
        .then((partialErrors) => {
          responseObject = new ResponseObject(requestObject, {acknowledge: true});
          if (partialErrors.length > 0) {
            responseObject.error = new PartialError('Some errors with provided rooms', partialErrors);
            responseObject.status = responseObject.error.status;
          }

          return deferred.resolve(responseObject);
        })
        .catch(error => {
          deferred.reject(error);
        });
    }
    else {
      removeAllRoomsInCollection.call(this, requestObject.index, requestObject.collection)
        .then(() => {
          return deferred.resolve(new ResponseObject(requestObject, {acknowledge: true}));
        })
        .catch(error => {
          deferred.reject(error);
        });
    }

    return deferred.promise;
  };

  this.getRealtimeCollections = function () {
    var collections = [];

    Object.keys(this.rooms).forEach(room => {
      collections.push(this.rooms[room].collection);
    });

    return _.uniq(collections);
  };
};

/** MANAGE ROOMS **/

/**
 * Remove all rooms for provided collection
 * Will remove room from dsl.filtersTree, hotelClerk.rooms and for each customers.
 *
 * @param index
 * @param collection
 * @returns {Promise} resolve nothing
 */
function removeAllRoomsInCollection (index, collection) {
  var
    deferred = q.defer();

  // Remove rooms in global and in each fields
  async.parallel([
    // remove rooms from global subscription
    callbackParallel => {
      if (!this.kuzzle.dsl.filtersTree[index][collection].rooms) {
        return callbackParallel();
      }

      async.each(this.kuzzle.dsl.filtersTree[index][collection].rooms, (roomId, callback) => {
        removeRoomEverywhere.call(this, roomId)
          .then(() => {
            callback();
          })
          .catch(error => {
            callback(error);
          });
      }, error => {
        callbackParallel(error);
      });
    },
    // remove rooms from each fields
    callbackParallel => {
      if (!this.kuzzle.dsl.filtersTree[index][collection].fields) {
        return callbackParallel();
      }

      _.forEach(this.kuzzle.dsl.filtersTree[index][collection].fields, field => {
        _.forEach(field, curryFunction => {
          async.each(curryFunction.rooms, (roomId, callback) => {
            removeRoomEverywhere.call(this, roomId)
              .then(() => {
                callback();
              })
              .catch(error => {
                callback(error);
              });
          }, error => {
            callbackParallel(error);
          });
        });
      });
    }
  ], error => {
    if (error) {
      return deferred.reject(error);
    }

    deferred.resolve();
  });

  return deferred.promise;
}

function removeListRoomsInCollection (index, collection, rooms) {
  var
    deferred = q.defer(),
    partialErrors = [];

  async.each(rooms, (roomId, callback) => {
    if (!this.rooms[roomId]) {
      // don't stop the loop if error occured but return a partial error to user
      partialErrors.push('No room with id ' + roomId);
      return callback();
    }

    if (this.rooms[roomId].index !== index) {
      // don't stop the loop if error occured but return a partial error to user
      partialErrors.push('The room with id ' + roomId + ' doesn\'t correspond to index ' + index);
      return callback();
    }

    if (this.rooms[roomId].collection !== collection) {
      // don't stop the loop if error occured but return a partial error to user
      partialErrors.push('The room with id ' + roomId + ' doesn\'t correspond to collection ' + collection);
      return callback();
    }

    removeRoomEverywhere.call(this, roomId)
      .then(() => {
        callback();
      })
      .catch(error => {
        callback(error);
      });
  }, error => {
    if (error) {
      return deferred.reject(error);
    }

    deferred.resolve(partialErrors);
  });

  return deferred.promise;
}

/**
 * Create new room if needed
 *
 * @param {String} index
 * @param {String} collection
 * @param {Object} filters
 * @returns {Promise} promise
 */
function createRoom (index, collection, filters) {
  var
    deferred = q.defer(),
    self = this,
    sortedFilters = [],
    stringifiedFilters,
    stringifiedObject,
    roomId;

  /*
   Ensure the resulting room id is identical even if the order of filters terms is changed.
   This should do the trick for now, but a deep sort() would probably be better.
    */
  if (!filters) {
    filters = {};
  }

  Object.keys(filters).forEach(key => sortedFilters.push([key, filters[key]]));
  stringifiedFilters = stringify(sortedFilters.sort((a, b) => {
    return String(a[0]).localeCompare(b[0]);
  }));

  stringifiedObject = stringify({index: index, collection: collection, filters: stringifiedFilters});

  roomId = crypto.createHash('md5').update(stringifiedObject).digest('hex');

  async.retry(function(callback) {
    // if the room is about to be destroyed, we have to delay its re-creation until its destruction has completed
    if (self.rooms[roomId] && self.rooms[roomId].destroyed) {
      return callback(new InternalError('Cannot create the room ' + roomId + ' because it has been marked for destruction'));
    }

    if (!self.rooms[roomId]) {
      // If it's a new room, we have to calculate filters to apply on the future documents
      addRoomAndFilters.call(self, roomId, index, collection, filters)
        .then(formattedFilters => {
          if (!self.rooms[roomId]) {
            self.kuzzle.pluginsManager.trigger('room:new', {roomId: roomId, index: index, collection: collection, filters: filters});

            self.rooms[roomId] = {
              id: roomId,
              customers: [],
              index: index,
              channels: {},
              collection: collection
            };

            // In case the user subscribe on the whole collection, there is no formattedFilters
            if (formattedFilters) {
              self.rooms[roomId].filters = formattedFilters;
            }
          }

          callback(null, roomId);
        })
        .catch(error => callback(error));
    }
    else {
      callback(null, roomId);
    }
  }, function (err, res) {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve(res);
    }
  });

  return deferred.promise;
}

/**
 * Associate the room to the connectionId in this.clients
 * Allow to manage later disconnection and delete socket/rooms/...
 *
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
 * @return {promise}
 */
function createChannelConfiguration (requestObject) {
  var
    deferred = q.defer(),
    channel = {};

  if (requestObject.state && ['all', 'done', 'pending'].indexOf(requestObject.state) === -1) {
    deferred.reject(new BadRequestError('Incorrect value for the "state" parameter. Expected: all, done or pending. Got: ' + requestObject.state));
    return deferred.promise;
  } else if (!requestObject.state) {
    channel.state = 'done';
  } else {
    channel.state = requestObject.state;
  }

  if (requestObject.scope && ['all', 'in', 'out', 'none'].indexOf(requestObject.scope) === -1) {
    deferred.reject(new BadRequestError('Incorrect value for the "scope" parameter. Expected: all, in, out or none. Got: ' + requestObject.scope));
    return deferred.promise;
  } else if (!requestObject.scope) {
    channel.scope = 'all';
  } else {
    channel.scope = requestObject.scope;
  }

  if (requestObject.users && ['all', 'in', 'out', 'none'].indexOf(requestObject.users) === -1) {
    deferred.reject(new BadRequestError('Incorrect value for the "users" parameter. Expected: all, in, out or none. Got: ' + requestObject.users));
    return deferred.promise;
  } else if (!requestObject.users) {
    channel.users = 'none';
  } else {
    channel.users = requestObject.users;
  }

  deferred.resolve(channel);

  return deferred.promise;
}

/**
 * Delete room if no user has subscribed to it, and remove also the room in the
 * filterTree object
 *
 * @param roomId
 * @returns {Promise}
 */
function cleanUpRooms (roomId) {
  var deferred = q.defer();

  if (this.rooms[roomId].customers.length === 0 && !this.rooms[roomId].destroyed) {
    /*
     This flag ensures that a room is destroyed only once.
     Multiple room cleanup might happen when different users unsubscribe at the same time, and trying
     to destroy the same room multiple times lead to unpredictable results
     */
    this.rooms[roomId].destroyed = true;

    this.kuzzle.dsl.removeRoom(this.rooms[roomId])
      .then(() => {
        this.kuzzle.pluginsManager.trigger('room:remove', roomId);
        deferred.resolve(roomId);
      })
      .catch(error => {
        this.kuzzle.pluginsManager.trigger('log:error', error);
        deferred.reject(error);
      })
      .finally(() => delete this.rooms[roomId]);

  }
  else {
    deferred.resolve(roomId);
  }

  return deferred.promise;
}

/**
 * Remove a room everywhere: in customers, in dsl.filtersTree and this.rooms
 * Allow to delete a room with action admin/removeRooms or admin/removeRooms
 *
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
 * @param {Object} connection
 * @param {String} roomId
 * @return {Promise} promise
 */
function removeRoomForCustomer (connection, roomId) {
  var deferred = q.defer();

  if (!this.customers[connection.id]) {
    deferred.reject(new NotFoundError('The user with connection ' + connection.id + ' doesn\'t exist'));
    return deferred.promise;
  }

  if (!this.customers[connection.id][roomId]) {
    deferred.reject(new NotFoundError('The user with connectionId ' + connection.id + ' doesn\'t listen the room ' + roomId));
    return deferred.promise;
  }

  deferred.resolve(roomId);

  Object.keys(this.rooms[roomId].channels).forEach(channel => {
    this.kuzzle.pluginsManager.trigger('protocol:leaveChannel', {channel, id: connection.id});
  });

  this.rooms[roomId].customers.splice(this.rooms[roomId].customers.indexOf(connection.id), 1);

  cleanUpRooms.call(this, roomId)
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


        this.kuzzle.notifier.notify(roomId, (new RealTimeResponseObject(roomId, requestObject, {count: count})).toJson());
      }

      if (Object.keys(this.customers[connection.id]).length > 1) {
        delete this.customers[connection.id][roomId];
      } else {
        delete this.customers[connection.id];
      }
    });

  return deferred.promise;
}

/**
 * Remove a roomId for all customers (allow to delete a room everywhere)
 *
 * @param roomId
 * @returns {Promise} resolve nothing
 */
function removeRoomForAllCustomers (roomId) {
  var
    deferred = q.defer();

  async.each(Object.keys(this.customers), (customerId, callbackCustomer)=> {
    async.each(Object.keys(this.customers[customerId]), (customerRoomId, callbackRoom) => {
      if (customerRoomId === roomId) {
        delete this.customers[customerId][customerRoomId];
      }

      callbackRoom();
    }, () => {
      callbackCustomer();
    });
  }, () => {
    deferred.resolve();
  });

  return deferred.promise;
}

/** MANAGE FILTERS TREE **/

/**
 * Create curried filters function and add collection/field/filters/room to the filtersTree object
 *
 * Transform something like:
 * {
 *  term: { 'subject': 'kuzzle' }
 * }
 *
 * Into something like:
 * {
 *  subject: { 'termSubjectKuzzle' : { fn: function () {}, rooms: [] } },
 * }
 * And inject it in the right place in filtersTree according to the collection and field
 *
 * @param {String} roomId
 * @param {String} index
 * @param {String} collection
 * @param {Object} filters
 * @return {promise} promise. Resolve a list of path that points to filtersTree object
 */
function addRoomAndFilters (roomId, index, collection, filters) {
  if (!filters || _.isEmpty(filters)) {
    return this.kuzzle.dsl.addCollectionSubscription(roomId, index, collection);
  }

  return this.kuzzle.dsl.addCurriedFunction(roomId, index, collection, filters);
}

/**
 * subscribe the user to an existing room.
 *
 * @param {String} roomId
 * @param {RequestObject} requestObject
 * @param {Object} context
 * @returns {RealTimeResponseObject}
 */
function subscribeToRoom (roomId, requestObject, context) {
  var
    connection = context.connection,
    deferred = q.defer();

  createChannelConfiguration(requestObject)
    .then(channel => {
      var channelName = roomId + '-' + crypto.createHash('md5').update(JSON.stringify(channel)).digest('hex');

      if (!this.customers[connection.id] || !this.customers[connection.id][roomId]) {
        addRoomForCustomer.call(this, connection, roomId, requestObject.metadata);

        this.kuzzle.notifier.notify(roomId, (new RealTimeResponseObject(roomId, requestObject, {count: this.rooms[roomId].customers.length})).toJson());
      }

      this.kuzzle.pluginsManager.trigger('protocol:joinChannel', {channel: channelName, id: connection.id});
      this.rooms[roomId].channels[channelName] = channel;
      deferred.resolve(new RealTimeResponseObject(roomId, requestObject, {channel: channelName}));
    })
    .catch(error => deferred.reject(error));

  return deferred.promise;
}
