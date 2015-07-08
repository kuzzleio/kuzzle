var
  rp = require('request-promise'),
  _ = require('lodash');


module.exports = logger =  {

  kuzzle: null,

  /**
   * @param kuzzle
   * @returns {boolean}
   */
  init: function (kuzzle) {
    logger.kuzzle = kuzzle;
  },

  /**
   * send data fro probe with state
   * @param event object the event from probe
   */
  add: function (event) {
    //console.log("object in service to ",process.env.LOG_ENGINE_HOST);
    //data = ;

    var probe = {
      event : _.clone(event),
      timestamp : Date.now()
    };

    var kuzzleState = {
      nbRooms     :  Object.keys(this.kuzzle.hotelClerk.rooms).length,
      nbCutsomers : Object.keys(this.kuzzle.hotelClerk.customers).length
    };

    probe.kuzzleState = kuzzleState;


    rp({
      url: 'http://' + process.env.LOG_ENGINE_HOST,
      method: 'GET',
      json: probe
    });
  }

};
