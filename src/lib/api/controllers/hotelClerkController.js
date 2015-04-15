module.exports = function HotelClerkController (kuzzle) {

  /**
   * A simple room list with filter associate and how many users have subscribed
   * Example for subscribe to a chat room where the subject is Kuzzle
   *  rooms = {
   *    "chat-room-kuzzle" : { -> the room name
   *      "count": 100 -> how many users have subscribed to this room
   *      "filter": { -> the filter to apply to the new document for test if we have to send the document to chat-room-kuzzle
   *        "term": { "subject": "kuzzle" }
   *      }
   *    }
   *  }
   */
  this.rooms = {};

  /**
   *
   * A complex tree where we have an entry by collection, on entry by tag and
   * an entry by filter(curried function) with the room list
   * Example for chat-room-kuzzle (see above)
   *  filtersTree = {
   *    "messages" : { -> collection name
   *      "subject" : { -> attribute where a filter exists
   *        "termSubjectKuzzle" : [ -> curried function that return true if the subject is equal to kuzzle
   *          "chat-room-kuzzle" -> associated room
   *        ]
   *      }
   *    }
   *  }
   */
  this.filtersTree = {};

  this.addSubscriberRoom = function (room, collection, filter) {
    if (!this.rooms[room]) {
      this.rooms[room] = {
        count : 0,
        filter : filter
      };

      addFilter(room, collection, kuzzle.dsl.parseFilter(filter));
    }

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

};