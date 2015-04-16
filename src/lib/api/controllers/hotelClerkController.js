var
  _ = require('lodash'),
  async = require('async');


module.exports = function HotelClerkController (kuzzle) {

  this.kuzzle = kuzzle;
  /**
   * A simple room list with filter associate and how many users have subscribed
   *
   * Example for subscribe to a chat room where the subject is Kuzzle
   *  rooms = {
   *    'chat-room-kuzzle' : { // -> the room name
   *      collection: message // -> collection that we want to retrieve
   *      count: 100 // -> how many users have subscribed to this room
   *      filters: { // -> filters to apply for test if we have to send the document to chat-room-kuzzle
   *        subject : termSubjectKuzzle // -> attribute and curryed function
   *      }
   *    }
   *  }
   */
  this.rooms = {};
  /**
   * In addition to this.rooms, this.customers allow to manage users and their rooms
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
   *        termSubjectKuzzle : [ // -> curried function that return true if the subject is equal to kuzzle
   *          'chat-room-kuzzle' // -> associated room
   *        ]
   *      }
   *    }
   *  }
   */
  this.filtersTree = {};


  // BIND PRIVATE METHODS
  addRoomForCustomer = _.bind(addRoomForCustomer, this);
  addRoomAndFilter = _.bind(addRoomAndFilter, this);
  removeRoomForCustomer = _.bind(removeRoomForCustomer, this);
  cleanUpRooms = _.bind(cleanUpRooms, this);
  cleanUpCustomers = _.bind(cleanUpCustomers, this);
  removeRoomFromFilterTree = _.bind(removeRoomFromFilterTree, this);
  cleanUpTree = _.bind(cleanUpTree, this);


  /**
   * Add a connectionId to room, and init all information about room if it doesn't exist before
   *
   * @param connectionId
   * @param room
   * @param collection
   * @param filter
   */
  this.addSubscription = function (connectionId, room, collection, filter) {

    if (!this.rooms[room]) {
      // If it's a new room, we have to calculate filters to apply on the future documents
      var filters = addRoomAndFilter(room, collection, filter);

      if (!filters) {
        return false;
      }

      this.rooms[room] = {
        collection : collection,
        count : 0,
        filters : filters
      };
    }

    // Add the room for the customer
    addRoomForCustomer(connectionId, room);
    this.rooms[room].count++;
  };

  /**
   * Remove the connectionId from the room and clean up room (delete room if there is no customer)
   * @param connectionId
   * @param room
   * @returns {boolean}
   */
  this.removeSubscription = function (connectionId, room) {
    // Remove the room for the customer
    removeRoomForCustomer(connectionId, room);

    if (!this.rooms[room]) {
      return false;
    }

    this.rooms[room].count--;
    cleanUpRooms(room);
  };

  /**
   * This function will delete customer from this.customers and
   * decrement count in this.rooms for rooms where user has subscribed
   * Typically called on user disconnection
   *
   * @param connectionId can be a socket.id
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
      cleanUpRooms(room);
    }.bind(this));

    delete this.customers[connectionId];
  };
};



/** MANAGE ROOMS **/

/**
 * Associate the room to the connectionId in this.clients
 * Allow to manage later disconnection and delete socket/rooms/...
 * @param connectionId
 * @param room
 */
addRoomForCustomer = function (connectionId, room) {
  if (!this.customers[connectionId]) {
    this.customers[connectionId] = [];
  }

  this.customers[connectionId].push(room);
};

cleanUpRooms = function (room) {
  if (!this.rooms[room]) {
    return false;
  }

  if (this.rooms[room].count === 0) {
    removeRoomFromFilterTree(room);
    delete this.rooms[room];
  }
};


/** MANAGE CUSTOMERS **/

cleanUpCustomers = function (connectionId) {
  if (_.isEmpty(this.customers[connectionId])) {
    delete this.customers[connectionId];
  }
};

removeRoomForCustomer = function (connectionId, room) {
  if (!this.customers[connectionId]) {
    return false;
  }

  var index = this.customers[connectionId].indexOf(room);
  if (index > -1) {
    this.customers[connectionId].slice(index, 1);
  }

  cleanUpCustomers(connectionId);
};


/** MANAGE FILTERS TREE **/

addRoomAndFilter = function (room, collection, filter) {

  filter = this.kuzzle.dsl.filterTransformer(filter);

  if (!filter) {
    return false;
  }

  if (!this.filtersTree[collection]) {
    this.filtersTree[collection] = {};
  }

  if (!this.filtersTree[collection][filter.field]) {
    this.filtersTree[collection][filter.field] = {};
  }

  if (!this.filtersTree[collection][filter.field][filter.fn]) {
    this.filtersTree[collection][filter.field][filter.fn] = [];
  }

  this.filtersTree[collection][filter.field][filter.fn].push(room);
};

/**
 * Delete the room from filterTree
 * If the room was the only room for the filter, we have to delete the filter
 * If the filter was the only filter for the field, we have to remove the field
 * If the field was the only field of the collection, we have to remove the collection

 * @param room
 */
removeRoomFromFilterTree = function (room) {
  if (!this.rooms[room]) {
    return false;
  }

  var
    collection = this.rooms[room].collection,
    filters = this.rooms[room].filters;

  // Can't run asynchronously because of concurrency access of filtersTree
  filters.forEach(function (filter, field) {
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

    // Now we have delete the room, we need to clean up the tree
    cleanUpTree(collection, filter, field);

  }.bind(this));
};


// Remove all unused entry in any level in filtersTree variable
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