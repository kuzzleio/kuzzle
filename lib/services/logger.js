var
  rp = require('request-promise'),
  _ = require('lodash');


module.exports = logger =  {

  kuzzle: null,

  /**
   * @param kuzzle
   */
  init: function (kuzzle) {
    logger.kuzzle = kuzzle;
  },

  /**
   * send data from probe with kuzzle state
   * @param event object the event from probe
   */
  add: function (event) {

    var probe = {
      event : _.clone(event),
      timestamp : Date.now(),
      kuzzleState : {
        nbRooms     :  Object.keys(this.kuzzle.hotelClerk.rooms).length,
        nbCustomers : Object.keys(this.kuzzle.hotelClerk.customers).length
      }
    };

    rp({
      url: 'http://' + process.env.LOG_ENGINE_HOST,
      method: 'GET',
      json: probe
    });
  }

};
