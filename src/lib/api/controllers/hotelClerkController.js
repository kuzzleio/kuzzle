var
  async = require('async');


module.exports = function HotelClerkController (kuzzle) {

  /**
   * A simple room list with filter associate and how many users have subscribed
   *
   * Example for subscribe to a chat room where the subject is Kuzzle
   *  rooms = {
   *    'chat-room-kuzzle' : { // -> the room name
   *      collection: message // -> collection that we want to retrieve
   *      count: 100 // -> how many users have subscribed to this room
   *      filter: { // -> the filter to apply for test if we have to send the document to chat-room-kuzzle
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


  this.addSubscription = function (connectionId, room, collection, filter) {

    if (!this.rooms[room]) {
      // If it's a new room, we have to calculate filters to apply on the future documents
      var filterDetail = this.addRoomAndFilter(room, collection, filter);

      if (!filterDetail) {
        return false;
      }

      this.rooms[room] = {
        collection : collection,
        count : 0,
        filter : filter,
        filterDetail : filterDetail
      };
    }

    // Add the room for the customer
    this.addRoomForCustomer(connectionId, room);
    this.rooms[room].count++;
  };

  this.removeSubscription = function (connectionId, room) {
    // Remove the room for the customer
    this.removeRoomForCustomer(connectionId, room);

    if (!this.rooms[room]) {
      return false;
    }

    this.rooms[room].count--;

    if (this.rooms[room].count === 0) {
      delete this.rooms[room];

      this.removeRoomFromFilter();
    }

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
    }.bind(this));

    delete this.customers[connectionId];
  };

  /**
   * Associate the room to the connectionId in this.clients
   * Allow to manage later disconnection and delete socket/rooms/...
   * @param connectionId
   * @param room
   */
  this.addRoomForCustomer = function (connectionId, room) {
    if (!this.customers[connectionId]) {
      this.customers[connectionId] = [];
    }

    this.customers[connectionId].push(room);
  };

  this.removeRoomForCustomer = function (connectionId, room) {

  };

  this.addRoomAndFilter = function (room, collection, filter) {

    filter = kuzzle.dsl.filterTransformer(filter);

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

};