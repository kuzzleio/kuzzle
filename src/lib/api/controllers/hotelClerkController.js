module.exports = function HotelClerkController (kuzzle) {

  /**
   * A simple room list with filter associate and how many users have subscribed
   *
   * Example for subscribe to a chat room where the subject is Kuzzle
   *  rooms = {
   *    'chat-room-kuzzle' : { // -> the room name
   *      count: 100 // -> how many users have subscribed to this room
   *      'filter': { // -> the filter to apply for test if we have to send the document to chat-room-kuzzle
   *        'term': { 'subject': 'kuzzle' }
   *      }
   *    }
   *  }
   */
  this.rooms = {};
  /**
   * In addition to this.rooms, socketsRoom allow to manage socket (= user), rooms and filters
   */
  this.socketsRoom = {};
  /**
   *
   * A tree where we have an entry by collection, an entry by tag and
   * an entry by filter (curried function) with the rooms list
   *
   * Example for chat-room-kuzzle (see above)
   *  filtersTree = {
   *    messages : { // -> collection name
   *      subject : { // -> attribute where a filter exists
   *        termSubjectKuzzle : [ // -> curried function that return true if the subject is equal to kuzzle
   *          "chat-room-kuzzle" // -> associated room
   *        ]
   *      }
   *    }
   *  }
   */
  this.filtersTree = {};


  this.addSubscriberRoom = function (socket, room, collection, filter) {
    if (!this.rooms[room]) {
      this.rooms[room] = {
        count : 0,
        filter : filter
      };

      this.addFilter(room, collection, kuzzle.dsl.filterTransformer(filter));
    }

    this.addSocket(socket.id, room);
    this.rooms[room].count++;
  };

  this.removeSubscriberRoom = function (room) {
    if (!this.rooms[room]) {
      return false;
    }

    this.rooms[room].count--;

    if (this.rooms[room].count === 0) {
      delete this.rooms[room];

      // TODO: delete room from tree
    }
  };

  this.addFilter = function (room, collection, filter) {

  };

  /**
   * Associate the room to the socket in this.socketsRoom
   * Allow to manage later disconnection and delete socket/rooms/...
   * @param socket
   * @param room
   */
  this.addSocket = function (socket, room) {
    if (!this.socketsRoom[socket]) {
      this.socketsRoom[socket] = [];
    }

    this.socketsRoom[socket].push(room);
    console.log(this.socketsRoom);
  };

};