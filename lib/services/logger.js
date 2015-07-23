var
  rp = require('request-promise'),
  _ = require('lodash'),
  request = require('request'),
  util = require('util');


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
   * @param object a RequestObject, error, or relevant info for event
   * @param event hook from probe (exemple : "data:delete")
   */
  log: function (object,hookEvent) {

    //some node.js data about the proccess
    var processData = {
      pid : process.pid,
      memory: util.inspect(process.memoryUsage())
    };

    //undefined in non POSIX OS
    if(process.getgid)
      processData.gid = process.getgid();

    var log = {
      hookEvent : hookEvent,
      processData : processData,
      timestamp : Date.now(),
      kuzzleState : {
        nbRooms     :  Object.keys(this.kuzzle.hotelClerk.rooms).length,
        nbCustomers : Object.keys(this.kuzzle.hotelClerk.customers).length
      }
    };

    if(object){
      log.object = _.clone(object);
    }

    rp({
      url: 'http://' + process.env.LOG_ENGINE_HOST,
      method: 'GET',
      json: {message : log }
    });
  }

};
