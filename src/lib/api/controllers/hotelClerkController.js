var
  _ = require('lodash'),
  async = require('async'),
  q = require('q'),
  stringify = require('json-stable-stringify'),
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
   *      filters: [ message.subject.termSubjectKuzzle ] // -> filters needed to send message to this room
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
   *
   * A tree where we have an entry by collection, an entry by tag and
   * an entry by filter (curried function) with the rooms list
   *
   * Example for chat-room-kuzzle (see above)
   *  filtersTree = {
   *    message : { // -> collection name
   *      subject : { // -> attribute where a filter exists
   *        termSubjectKuzzle : {
   *          rooms: [ 'f45de4d8ef4f3ze4ffzer85d4fgkzm41'], // -> room id that match this filter
   *          fn: function () {} // -> function to execute on collection message, on field subject
   *        }
   *      }
   *    }
   *  }
   */
  this.filtersTree = {};


  // BIND PRIVATE METHODS
  var tools = {};
  tools.addRoomForCustomer = _.bind(addRoomForCustomer, this);
  tools.removeRoomForCustomer = _.bind(removeRoomForCustomer, this);
  tools.createRoom = _.bind(createRoom, this);
  tools.cleanUpRooms = _.bind(cleanUpRooms, this);

  /**
   * Add a connection.id to room, and init information about room if it doesn't exist before
   *
   * @param {Object} connection
   * @param {String} roomName
   * @param {String} collection
   * @param {Object} filters
   * @return {Promise} promise. Return nothing on success. Reject with error if the
   * user has already subscribe to this room name (just for room with same name, but we not trigger error
   * if the room has a different name with same filter) or if there is an error during room creation
   */
  this.addSubscription = function (connection, roomName, collection, filters) {
    var
      deferred = q.defer();

    if (this.customers[connection.id] && this.customers[connection.id][roomName]) {
      deferred.reject('User already subscribe to the room '+roomName);
      return deferred.promise;
    }

    tools.createRoom(roomName, collection, filters)
      .then(function (roomId) {
        // Add the room for the customer
        tools.addRoomForCustomer(connection.id, roomName, roomId);
        this.rooms[roomId].count++;
        deferred.resolve({ data: roomId, rooms: [roomName], connections: [connection] });
      }.bind(this))
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Remove the connection.id from the room and clean up room (delete room if there is no customer)
   *
   * @param {Object} connection
   * @param {String} roomName
   * @returns {Promise} promise
   */
  this.removeSubscription = function (connection, roomName) {
    var deferred = q.defer();

    // Remove the room for the customer, don't wait for delete before continue
    tools.removeRoomForCustomer(connection.id, roomName)
      .then(function (roomId) {
        if (!this.rooms[roomId]) {
          deferred.reject('Room ' + room + ' with id ' + roomId + ' doesn\'t exist');
        }

        this.rooms[roomId].count--;
        tools.cleanUpRooms(roomId);

        deferred.resolve({ data: roomId, rooms: [roomName], connections: [connection] });
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
   */
  this.removeCustomerFromAllRooms = function (connectionId) {
    if (!this.customers[connectionId]) {
      return false;
    }

    var rooms = this.customers[connectionId];
    async.each(Object.keys(rooms), function (roomName) {
      var roomId = rooms[roomName];
      if (!this.rooms[roomId]) {
        return false;
      }

      this.rooms[roomId].count--;
      tools.cleanUpRooms(roomId);
    }.bind(this));

    delete this.customers[connectionId];
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
    tools = {},
    deferred = q.defer(),
    stringifyObject = stringify({collection: collection, filters: filters}),
    roomId = crypto.createHash('md5').update(stringifyObject).digest('hex');

  this.kuzzle.log.debug('Create room: ' + roomId,  {collection: collection, filters: filters});

  if (!this.rooms[roomId]) {
    // If it's a new room, we have to calculate filters to apply on the future documents
    tools.addRoomAndFilters = _.bind(addRoomAndFilters, this);
    tools.addRoomAndFilters(roomId, collection, filters)
      .then(function (pathFilterList) {
        this.rooms[roomId] = {
          names: [],
          count : 0,
          filters : pathFilterList
        };

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
 * @param {String} roomId
 */
cleanUpRooms = function (roomId) {
  var tools = {};
  tools.removeRoomFromFilterTree = _.bind(removeRoomFromFilterTree, this);

  if (!this.rooms[roomId]) {
    return false;
  }
  if (this.rooms[roomId].count === 0) {
    tools.removeRoomFromFilterTree(roomId);
    delete this.rooms[roomId];
  }
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
    tools = {},
    roomId;

  tools.cleanUpCustomers = _.bind(cleanUpCustomers, this);

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
  tools.cleanUpCustomers(connectionId);

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
 *  range: { 'star': { 'gte': 3 } }
 * }
 *
 * Into something like:
 * {
 *  subject: { 'termSubjectKuzzle' : { fn: function () {}, rooms: [] } },
 *  star: { 'rangeStarGte3' : { fn: function () {} }, rooms: [] }
 * }
 * And inject it in the right place in filtersTree according to the collection and field
 *
 * @param {String} roomId
 * @param {String} collection
 * @param {Object} filters
 * @return {Promise} promise. Resolve a list of path that points to filtersTree object
 */
addRoomAndFilters = function (roomId, collection, filters) {
  var
    deferred = q.defer(),
    pathFilterList = [];

  this.kuzzle.dsl.getFunctionsNames(collection, filters)
    .then(function (filtersNames) {

      async.each(Object.keys(filtersNames), function (name, callback) {
        var
          fn = Object.keys(filtersNames[name])[0],
          filter = filtersNames[name][fn],
          field = Object.keys(filter)[0];

        if (!this.filtersTree[collection]) {
          this.filtersTree[collection] = {};
        }
        if (!this.filtersTree[collection][field]) {
          this.filtersTree[collection][field] = {};
        }

        if (!this.filtersTree[collection][field][name]) {
          this.filtersTree[collection][field][name] = {
            rooms: [],
            fn: this.kuzzle.dsl.createCurriedFunction(name, filtersNames[name])
          };

          // push the path to in filtersTree for retrieve the function
          pathFilterList.push(collection+'.'+field+'.'+name);
        }

        this.filtersTree[collection][field][name].rooms.push(roomId);
        callback();

      }.bind(this), function () {
        deferred.resolve(pathFilterList);
      });
    }.bind(this));

  return deferred.promise;
};

/**
 * Delete the room from filterTree
 * If the room was the only room for the filter, we have to delete the filter
 * If the filter was the only filter for the field, we have to remove the field
 * If the field was the only field of the collection, we have to remove the collection

 * @param {String} roomId
 */
removeRoomFromFilterTree = function (roomId) {
  var deferred = q.defer();

  if (!this.rooms[roomId]) {
    deferred.reject();
    return deferred.promise;
  }

  var tools = {};
  tools.recursiveCleanUpTree = _.bind(recursiveCleanUpTree, this);

  var filters = this.rooms[roomId].filters;

  async.each(filters, function (filterPath, callback) {
    tools.recursiveCleanUpTree(this.filtersTree, filterPath, roomId);
    callback();

  }.bind(this), function () {
    deferred.resolve();
  });

  return deferred.promise;
};

/**
 * Recursively test filtersTree object according to the path.
 * Delete entry if it's empty and reach back in the object
 *
 * @param {Object} object
 * @param {String} path
 * @param {String} roomId
 */
recursiveCleanUpTree = function (object, path, roomId) {
  var pathArray = path.split('.'),
      subPath = pathArray[pathArray.length-1],
      parent = object,
      i,
      index;

  for(i = 0; i < pathArray.length-1; i++) {
      parent = parent[pathArray[i]];
  }

  // If the current entry is the curried function (that contains the room list and the function definition)
  if (parent[subPath].rooms !== undefined) {
    index = parent[subPath].rooms.indexOf(roomId);
    if (index > -1) {
      parent[subPath].rooms.splice(index, 1);
    }

    if (parent[subPath].rooms.length > 0) {
      return false;
    }
  }
  // If it's not a function, test if the entry is not empty
  else if (!_.isEmpty(parent[subPath])) {
    return false;
  }

  delete parent[subPath];
  pathArray.pop();

  if (_.isEmpty(pathArray)) {
    return false;
  }

  return recursiveCleanUpTree(object, pathArray.join('.'));
};
