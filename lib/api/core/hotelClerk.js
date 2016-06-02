var
  _ = require('lodash'),
  async = require('async'),
  q = require('q'),
  stringify = require('json-stable-stringify'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
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
   *          'message.subject.termSubjectKuzzle': filtersTree.message.subject.termSubjectKuzzle.args
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
          this.kuzzle.clusterManager.broadcast(diff);
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
      return q.reject(new BadRequestError('The room ID is mandatory to unsubcribe to a room'));
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
      return q.reject(new BadRequestError('The room Id is mandatory to count subscriptions'));
    }

    if (!this.rooms[requestObject.data.body.roomId]) {
      return q.reject(new NotFoundError('The room Id ' + requestObject.data.body.roomId + ' does not exist'));
    }

    return q({count: this.rooms[requestObject.data.body.roomId].customers.length});
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
   * @param {object} context
   * @returns {Promise} resolve an object with collection, rooms, subscribers
   */
  this.listSubscriptions = function (context) {
    var
      list = {},
      deferred = q.defer(),
      requestObjectCollection = {
        action: 'search',
        controller: 'read'
      };

    async.each(Object.keys(this.rooms), (roomId, callback) => {
      var room = this.rooms[roomId];

      requestObjectCollection.index = room.index;
      requestObjectCollection.collection = room.collection;

      context.token.user.profile.isActionAllowed(requestObjectCollection, context, kuzzle)
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
    }, () => {
      deferred.resolve(list);
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

    return subscribeToRoom.call(this, roomId, requestObject, context)
      .then(response => {
        if (response.diff) {
          this.kuzzle.clusterManager.broadcast([ response.diff ]);
        }

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
      return q.reject(new BadRequestError('No index provided'));
    }

    if (!requestObject.collection) {
      return q.reject(new BadRequestError('No collection provided'));
    }

    if (!kuzzle.dsl.filtersTree[requestObject.index]) {
      return q.reject(new NotFoundError('No subscription on this index'));
    }

    if (!kuzzle.dsl.filtersTree[requestObject.index][requestObject.collection]) {
      return q.reject(new NotFoundError('No subscription on this collection'));
    }

    if (requestObject.data && requestObject.data.body && requestObject.data.body.rooms) {
      if (!Array.isArray(requestObject.data.body.rooms)) {
        return q.reject(new BadRequestError('The rooms attribute must be an array'));
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

  this.onClusterStateUpdate = function (diffs) {
    diffs.forEach(diff => {
      switch (Object.keys(diff)[0]) {
        case 'hcR':
          addRoomForCustomer.call(this, diff.hcR.c, diff.hcR.r, diff.hcR.m);
          break;
        case 'hcDel':
          removeRoomForCustomer.call(this, diff.hcDel.c, diff.hcDel.r, false);
          break;
        case 'ft':
          this.kuzzle.dsl.addToFiltersTree(
            diff.ft.i,
            diff.ft.c,
            diff.ft.f,
            diff.ft.o,
            diff.ft.v,
            diff.ft.fn,
            diff.ft.r,
            diff.ft.n,
            diff.ft.g
          );
          break;
      }
    });
  }
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
        _.forEach(field, fieldFilter => {
          async.each(fieldFilter.rooms, (roomId, callback) => {
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
    diff,
    deferred,
    self = this,
    sortedFilters = [],
    stringifiedFilters,
    stringifiedObject,
    roomId;

  /*
   Make sure an index and a collection are provided
   */
  if (!index || !collection) {
    return q.reject(new BadRequestError('Cannot subscribe without an index and a collection'));
  }

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

  deferred = q.defer();

  async.retry(function(callback) {
    // if the room is about to be destroyed, we have to delay its re-creation until its destruction has completed
    if (self.rooms[roomId] && self.rooms[roomId].destroyed) {
      return callback(new InternalError('Cannot create the room ' + roomId + ' because it has been marked for destruction'));
    }

    if (!self.rooms[roomId]) {
      // If it's a new room, we have to calculate filters to apply on the future documents
      addRoomAndFilters.call(self, roomId, index, collection, filters)
        .then(response => {
          var
            formattedFilters;

          if (response.filter !== undefined) {
            formattedFilters = response.filter;
          }

          diff = response.diff;

          if (self.rooms[roomId]) {
            return callback(null, roomId);
          }

          self.kuzzle.pluginsManager.trigger('room:new', {roomId: roomId, index: index, collection: collection, formattedFilters: formattedFilters})
            .then(modifiedData => {
              self.rooms[roomId] = {
                id: roomId,
                customers: [],
                index: modifiedData.index,
                channels: {},
                collection: modifiedData.collection
              };

              // In case the user subscribe on the whole collection, there is no formattedFilters
              if (modifiedData.formattedFilters) {
                self.rooms[roomId].filters = modifiedData.formattedFilters;
              }

              callback(null, roomId);
            });
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
      deferred.resolve({ diff: diff, roomId: res });
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
    channel = {};

  if (requestObject.state && ['all', 'done', 'pending'].indexOf(requestObject.state) === -1) {
    return q.reject(new BadRequestError('Incorrect value for the "state" parameter. Expected: all, done or pending. Got: ' + requestObject.state));
  } else if (!requestObject.state) {
    channel.state = 'done';
  } else {
    channel.state = requestObject.state;
  }

  if (requestObject.scope && ['all', 'in', 'out', 'none'].indexOf(requestObject.scope) === -1) {
    return q.reject(new BadRequestError('Incorrect value for the "scope" parameter. Expected: all, in, out or none. Got: ' + requestObject.scope));
  } else if (!requestObject.scope) {
    channel.scope = 'all';
  } else {
    channel.scope = requestObject.scope;
  }

  if (requestObject.users && ['all', 'in', 'out', 'none'].indexOf(requestObject.users) === -1) {
    return q.reject(new BadRequestError('Incorrect value for the "users" parameter. Expected: all, in, out or none. Got: ' + requestObject.users));
  } else if (!requestObject.users) {
    channel.users = 'none';
  } else {
    channel.users = requestObject.users;
  }

  return q(channel);
}

/**
 * Delete room if no user has subscribed to it, and remove also the room in the
 * filterTree object
 *
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

    return this.kuzzle.dsl.removeRoom(this.rooms[roomId])
      .then(() => {
        this.kuzzle.pluginsManager.trigger('room:remove', roomId);
        return roomId;
      })
      .catch(error => {
        this.kuzzle.pluginsManager.trigger('log:error', error);
        throw error;
      })
      .finally(() => delete this.rooms[roomId]);
  }

  return q(roomId);
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
function removeRoomForCustomer (connection, roomId, notifyCluster) {
  if (notifyCluster === undefined) {
    notifyCluster = true;
  }

  if (notifyCluster) {
    this.kuzzle.clusterManager.broadcast([{hcDel: { c: connection, r: roomId }}]);
  }

  if (!this.customers[connection.id]) {
    return q.reject(new NotFoundError('The user with connection ' + connection.id + ' doesn\'t exist'));
  }

  if (!this.customers[connection.id][roomId]) {
    return q.reject(new NotFoundError('The user with connectionId ' + connection.id + ' doesn\'t listen the room ' + roomId));
  }

  Object.keys(this.rooms[roomId].channels).forEach(channel => {
    this.kuzzle.entryPoints.lb.leaveChannel({channel, id: connection.id});
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
 * Add filters to the filtersTree object
 *
 * Transforms a filter like this one:
 * {
 *  term: { 'subject': 'kuzzle' }
 * }
 *
 * Into an encoded version:
 * {
 *  subject: { 'termSubjectKuzzle' : { args: {operator, not, field, value}, rooms: [] } },
 * }
 * And inject it in the right place in filtersTree according to the collection and field
 *
 * @param {String} roomId
 * @param {String} index
 * @param {String} collection
 * @param {Object} filters
 * @return {promise} promise. Resolves a list of path that points to filtersTree object
 */
function addRoomAndFilters (roomId, index, collection, filters) {
  if (!filters || _.isEmpty(filters)) {
    return this.kuzzle.dsl.addCollectionSubscription(roomId, index, collection);
  }

  return this.kuzzle.dsl.addSubscription(roomId, index, collection, filters);
}

/**
 * subscribe the user to an existing room.
 *
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
        channelName = roomId + '-' + crypto.createHash('md5').update(JSON.stringify(channel)).digest('hex'),
        diff;

      if (!this.customers[connection.id] || !this.customers[connection.id][roomId]) {
        addRoomForCustomer.call(this, connection, roomId, requestObject.metadata);

        diff = { hcR: {r: roomId, c: connection.id, m: requestObject.metadata }};

        this.kuzzle.notifier.notify(roomId, requestObject, {count: this.rooms[roomId].customers.length});
      }

      this.kuzzle.entryPoints.lb.joinChannel({channel: channelName, id: connection.id});
      this.kuzzle.pluginsManager.trigger('protocol:joinChannel', {channel: channelName, id: connection.id});
      this.rooms[roomId].channels[channelName] = channel;

      return {diff: diff, data: {roomId, channel: channelName}};
    });
}
