var
  _ = require('lodash'),
  async = require('async'),
  q = require('q'),
  stringify = require('json-stable-stringify'),
  RealTimeResponseObject = require('../core/models/realTimeResponseObject'),
  // module for manage md5 hash
  crypto = require('crypto');


module.exports = function HotelClerkController (kuzzle) {

  this.kuzzle = kuzzle;
  /**
   * A simple room list with filter associate and how many users have subscribed
   *
   * Example for subscribe to a chat room where the subject is Kuzzle
   *  rooms = {
   *    'f45de4d8ef4f3ze4ffzer85d4fgkzm41' : { // -> the room id (according to filters and collection)
   *      names: [ 'chat-room-kuzzle' ], // -> real room name list to notify
   *      count: 100 // -> how many users have subscribed to this room
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
   * In addition to this.rooms, this.customers allow to manage users and their rooms
   * Example for a customer who subscribes to the room 'chat-room-kuzzle'
   * customers = {
   *  '87fd-gre7ggth544z' : { // -> connection id (like socket id)
   *    'chat-room-kuzzle' : 'fr4fref4f8fre47fe' // -> mapping between user room and roomId
   *  }
   * }
   */
  this.customers = {};

  /**
   * Add a connection to room, and init information about room if it doesn't exist before
   *
   * @param {RequestObject} requestObject
   * @param {Object} connection
   *
   * @return {Promise} promise. Return a RealTimeResponseObject on success. Reject with error if the
   * user has already subscribe to this room name (just for room with same name, but we not trigger error
   * if the room has a different name with same filter) or if there is an error during room creation
   */
  this.addSubscription = function (requestObject, connection) {
    if (!_.isString(requestObject.requestId)) {
      requestObject.requestId = requestObject.requestId.toString();
    }

    var deferred = q.defer();

    if (this.customers[connection.id] && this.customers[connection.id][requestObject.requestId]) {
      deferred.reject('User ' + connection.id + ' has already subscribed to the room ' + requestObject.requestId);
      return deferred.promise;
    }

    createRoom.call(this, requestObject.requestId, requestObject.collection, requestObject.data.body)
      .then(function (roomId) {

        // Add the room for the customer
        addRoomForCustomer.call(this, connection.id, requestObject.requestId, roomId);
        this.rooms[roomId].count++;

        deferred.resolve(new RealTimeResponseObject(roomId, requestObject.requestId));
      }.bind(this))
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Remove the connection.id from the room and clean up room (delete room if there is no customer)
   *
   * @param {RequestObject} requestObject
   * @param {Object} connection
   *
   * @returns {Promise} promise
   */
  this.removeSubscription = function (requestObject, connection) {
    var deferred = q.defer();

    // Remove the room for the customer, don't wait for delete before continue
    removeRoomForCustomer.call(this, connection.id, requestObject.requestId)
      .then(function (roomId) {
        if (!this.rooms[roomId]) {
          deferred.reject('Room ' + requestObject.requestId + ' with id ' + roomId + ' doesn\'t exist');
        }

        this.rooms[roomId].count--;
        cleanUpRooms.call(this, roomId)
          .then(function () {
            deferred.resolve(new RealTimeResponseObject(roomId, requestObject.requestId));
          })
          .catch(function (error) {
            deferred.reject(error);
          });

      }.bind(this))
      .catch( function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * This function will delete customer from this.customers and
   * decrement count in this.rooms for rooms where user has subscribed
   * Call the cleanUpRooms function for manage empty room
   * Typically called on user disconnection
   *
   * @param {String} connectionId can be a socket.id
   * @param connectionId
   * @returns {Promise} reject an error or resolve nothing
   */
  this.removeCustomerFromAllRooms = function (connectionId) {
    var deferred = q.defer();

    if (!this.customers[connectionId]) {
      deferred.reject('Unknown user with connection id ' + connectionId);
      return deferred.promise;
    }

    var rooms = this.customers[connectionId];
    async.each(Object.keys(rooms), function (roomName, callback) {
      var roomId = rooms[roomName];
      if (!this.rooms[roomId]) {
        callback();
      }

      this.rooms[roomId].count--;
      cleanUpRooms.call(this, roomId)
        .then(function () {
          callback();
        })
        .catch(function (error) {
          callback(error);
        });

    }.bind(this), function (error) {
      if (error) {
        deferred.reject(error);
      }

      delete this.customers[connectionId];
      deferred.resolve();

    }.bind(this));

    return deferred.promise;
  };
};



/** MANAGE ROOMS **/

/**
 * Create new room if needed
 *
 * @param {String} room
 * @param {String} collection
 * @param {Object} filters
 * @returns {Promise} promise
 */
createRoom = function (room, collection, filters) {
  var
    deferred = q.defer(),
    stringifyObject = stringify({collection: collection, filters: filters}),
    roomId = crypto.createHash('md5').update(stringifyObject).digest('hex');

  this.kuzzle.log.debug('Create room: ' + roomId,  {collection: collection, filters: filters});

  if (!this.rooms[roomId]) {
    // If it's a new room, we have to calculate filters to apply on the future documents
    addRoomAndFilters.call(this, roomId, collection, filters)
      .then(function (formattedFilters) {

        if (!this.rooms[roomId]) {
          this.rooms[roomId] = {
            id: roomId,
            names: [],
            count: 0,
            filters: formattedFilters
          };
        }

        deferred.resolve(roomId);
      }.bind(this))
      .catch(function (error) {
        deferred.reject(error);
      });
  }
  else {
    deferred.resolve(roomId);
  }

  return deferred.promise;
};

/**
 * Associate the room to the connectionId in this.clients
 * Allow to manage later disconnection and delete socket/rooms/...
 *
 * @param {String} connectionId
 * @param {String} roomName
 * @param {String} roomId
 */
addRoomForCustomer = function (connectionId, roomName, roomId) {
  if (!this.customers[connectionId]) {
    this.customers[connectionId] = {};
  }

  this.rooms[roomId].names = _.uniq(this.rooms[roomId].names.concat([roomName]));
  this.customers[connectionId][roomName] = roomId;
};

/**
 * Delete room if no use has subscribed to this room and remove also the room in
 * filterTree object
 *
 * @param roomId
 * @returns {Promise}
 */
cleanUpRooms = function (roomId) {
  var deferred = q.defer();

  if (!this.rooms[roomId]) {
    deferred.reject('Room ' + roomId + 'doesn\t exist');
    return deferred.promise;
  }

  if (this.rooms[roomId].count === 0) {
    this.kuzzle.dsl.removeRoom(this.rooms[roomId])
      .then(function () {
        delete this.rooms[roomId];
        deferred.resolve();
      }.bind(this));
  }

  return deferred.promise;
};


/** MANAGE CUSTOMERS **/

/**
 * Remove the room from subscribed room from the user
 * Return the roomId in user mapping
 *
 * @param {String} connectionId
 * @param {String} roomName
 * @return {Promise} promise
 */
removeRoomForCustomer = function (connectionId, roomName) {
  var
    deferred = q.defer(),
    roomId;

  if (!this.customers[connectionId]) {
    deferred.reject('The user with connection ' + connectionId + ' doesn\'t exist');
    return deferred.promise;
  }

  if (!this.customers[connectionId][roomName]) {
    deferred.reject('The user with connectionId ' + connectionId + ' doesn\'t listen the room ' + roomName);
    return deferred.promise;
  }

  roomId = this.customers[connectionId][roomName];
  deferred.resolve(roomId);

  delete this.customers[connectionId][roomName];
  cleanUpCustomers.call(this, connectionId);

  return deferred.promise;
};

/**
 * Remove the user if he didn't has subscribed to a room
 *
 * @param {String} connectionId
 */
cleanUpCustomers = function (connectionId) {
  if (_.isEmpty(this.customers[connectionId])) {
    delete this.customers[connectionId];
  }
};


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
 * @param {String} collection
 * @param {Object} filters
 * @return {promise} promise. Resolve a list of path that points to filtersTree object
 */
addRoomAndFilters = function (roomId, collection, filters) {
  return this.kuzzle.dsl.addCurriedFunction(roomId, collection, filters);
};


