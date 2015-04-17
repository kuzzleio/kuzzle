var
  _ = require('lodash'),
  async = require('async'),
  q = require('q');


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
   *      filters: [ this.filtersTree.message.subject.termSubjectKuzzle ] // -> filters needed to send message to this room
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
   * Add a connectionId to room, and init information about room if it doesn't exist before
   *
   * @param {String} connectionId
   * @param {String} room
   * @param {String} collection
   * @param {Object} filters
   */
  this.addSubscription = function (connectionId, room, collection, filters) {
    var
      deferred = q.defer(),
      hotelClerkCtrl = this;

    tools.createRoom(room, collection, filters)
      .then(function (roomId) {
        // Add the room for the customer
        tools.addRoomForCustomer(connectionId, room, roomId);
        hotelClerkCtrl.rooms[roomId].count++;
        deferred.resolve();
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Remove the connectionId from the room and clean up room (delete room if there is no customer)
   *
   * @param {String} connectionId
   * @param {String} room
   * @returns {Promise} promise
   */
  this.removeSubscription = function (connectionId, room) {
    var deferred = q.defer();

    // Remove the room for the customer, don't wait for delete before continue
    tools.removeRoomForCustomer(connectionId, room)
      .then(function (roomId) {
        if (!this.rooms[roomId]) {
          deferred.reject('Room ' + room + ' with id ' + roomId + ' doesn\t exist');
        }

        this.rooms[room].count--;
        tools.cleanUpRooms(room);

        deferred.resolve();

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
    async.each(rooms, function (room) {
      if (!this.rooms[room]) {
        return false;
      }

      this.rooms[room].count--;
      tools.cleanUpRooms(room);
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
    stringifyObject = JSON.stringify({collection: collection, filters: filters}),
    roomId = crypto.createHash('md5').update(stringifyObject).digest('hex');

  if (!this.rooms[roomId]) {
    // If it's a new room, we have to calculate filters to apply on the future documents
    tools.addRoomAndFilters = _.bind(addRoomAndFilters, this);
    tools.addRoomAndFilters(roomId, collection, filters)
      .then(function (formattedFilters) {

        hotelClerkCtrl.rooms[roomId] = {
          count : 0,
          filters : formattedFilters
        };

        deferred.resolve(roomId);
      })
      .catch(function (error) {
        deferred.reject(error);
      });
  }
  else {
    deferred.resolve();
  }

  return deferred.promise;
};

/**
 * Associate the room to the connectionId in this.clients
 * Allow to manage later disconnection and delete socket/rooms/...
 *
 * @param {String} connectionId
 * @param {String} room
 * @param {String} roomId
 */
addRoomForCustomer = function (connectionId, room, roomId) {
  if (!this.customers[connectionId]) {
    this.customers[connectionId] = {};
  }

  this.customers[connectionId][room] = roomId;
};

/**
 * Delete room if no use has subscribed to this room and remove also the room in
 * filterTree object
 *
 * @param {String} room
 */
cleanUpRooms = function (room) {
  var tools = {};
  tools.removeRoomFromFilterTree = _.bind(removeRoomFromFilterTree, this);

  if (!this.rooms[room]) {
    return false;
  }

  if (this.rooms[room].count === 0) {
    tools.removeRoomFromFilterTree(room);
    delete this.rooms[room];
  }
};


/** MANAGE CUSTOMERS **/

/**
 * Remove the room from subscribed room from the user
 * Return the roomId in user mapping
 *
 * @param {String} connectionId
 * @param {String} room
 * @return {Promise} promise
 */
removeRoomForCustomer = function (connectionId, room) {
  var
    deferred = q.defer(),
    tools = {},
    roomId;

  tools.cleanUpCustomers = _.bind(cleanUpCustomers, this);

  if (!this.customers[connectionId]) {
    deferred.reject('The user with connection ' + connectionId + ' doesn\'t exist');
    return deferred.promise;
  }

  if (!this.customers[connectionId][room]) {
    deferred.reject('The user with connectionId ' + connectionId + ' doesn\'t listen the room ' + room);
    return deferred.promise;
  }

  roomId = this.customers[connectionId][room];
  deferred.resolve(roomId);

  delete this.customers[connectionId][room];
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
 * Create curried filters function and add collection/field/filters/room to
 * the filtersTree object
 *
 * @param {String} roomId
 * @param {String} collection
 * @param {Object} filters
 */
addRoomAndFilters = function (roomId, collection, filters) {
  var deferred = q.defer();

  this.kuzzle.dsl.filtersTransformer(filters)
    .then(function (formatedFilters) {

      // formatedFilters contains something like { subject : { termSubjectKuzzle : { fn: function() {} } } }
      async.each(Object.keys(formatedFilters), function (field) {
        // filter contains something like  { termSubjectKuzzle : { fn: function() {} } }
        var
          filter = formatedFilters[field],
          filterName = Object.keys(filter)[0];

        filter.rooms = [];

        if (!this.filtersTree[collection]) {
          this.filtersTree[collection] = formatedFilters;
        }

        if (!this.filtersTree[collection][field]) {
          this.filtersTree[collection][field] = filter;
        }

        if (!this.filtersTree[collection][field][filterName]) {
          this.filtersTree[collection][field] = _.merge(this.filtersTree[collection][field], filter);
        }

        this.filtersTree[collection][field][filterName].rooms.push(roomId);

      }.bind(this));

      deferred.resolve(formatedFilters);
    })
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};

/**
 * Delete the room from filterTree
 * If the room was the only room for the filter, we have to delete the filter
 * If the filter was the only filter for the field, we have to remove the field
 * If the field was the only field of the collection, we have to remove the collection

 * @param {String} room
 */
removeRoomFromFilterTree = function (room) {

  var tools = {};
  tools.cleanUpTree = _.bind(cleanUpTree, this);

  if (!this.rooms[room]) {
    return false;
  }

  var
    collection = this.rooms[room].collection,
    filters = this.rooms[room].filters;

  // Can't run asynchronously because of concurrency access of filtersTree
  _.each(filters, function (filter, field) {
    if (!this.filtersTree[collection]) {
      return false;
    }

    // corresponding to the list of field for the collection where we have filters
    if (!this.filtersTree[collection][field]) {
      return false;
    }

    // corresponding to the room list which use the filter
    if (!this.filtersTree[collection][field][filter]) {
      return false;
    }

    var index = this.filtersTree[collection][field][filter].indexOf(room);
    if (index > -1) {
      this.filtersTree[collection][field][filter].splice(index, 1);
    }

    // Now we have deleted the room, we need to clean up the tree
    tools.cleanUpTree(collection, filter, field);
  }.bind(this));
};


/**
 * Remove all unused entries in any level in filtersTree variable
 *
 * @param {String} collection
 * @param {String} filter
 * @param {String} field
 */
cleanUpTree = function (collection, filter, field) {
  // delete filter from field if it was the only room
  if (_.isEmpty(this.filtersTree[collection][field][filter])) {
    delete this.filtersTree[collection][field][filter];
  }

  // delete field from collection if it was the only filter
  if (_.isEmpty(this.filtersTree[collection][field])) {
    delete this.filtersTree[collection][field];
  }

  // delete collection from tree if it was the only field
  if (_.isEmpty(this.filtersTree[collection])) {
    delete this.filtersTree[collection];
  }
};