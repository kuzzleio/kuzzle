var
  rp = require('request-promise'),
  _ = require('lodash'),
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
   * return the process Data about Kuzzle
   */
  getProcessData: function(){
      var processData = {
      pid : process.pid,
      memory: util.inspect(process.memoryUsage())
    };

    //undefined in non POSIX OS
    if(process.getgid){
      processData.gid = process.getgid();
    }
    return processData;
  },


  /**
   * return the Kuzzle state
   *
   */
  getKuzzleState: function(){
    var kuzzleState = {};

    if(this.kuzzle.hotelClerk){
        kuzzleState.nbRooms = Object.keys(this.kuzzle.hotelClerk.rooms).length;
        kuzzleState.nbCustomers = Object.keys(this.kuzzle.hotelClerk.customers).length;
    };

    return kuzzleState;
  },

  /**
   * send data from log with kuzzle state
   * @param object a RequestObject,  or relevant info for event
   * @param hookEvent hook from log  (exemple : "data:delete")
   */
  log: function (object, hookEvent) {

    var log = {
      hookEvent : hookEvent,
      processData : this.getProcessData(),
      timestamp : Date.now(),
      object  : object,
      kuzzleState : this.getKuzzleState()
    };

    log.object = object;

    rp({
      url: 'http://' + process.env.LOG_ENGINE_HOST,
      method: 'GET',
      json: {message : log }
    });
  },

  error: function (error, hookEvent) {
    var log = {
      hookEvent : hookEvent,
      timestamp : Date.now(),
      processData : this.getProcessData(),
      kuzzleState : this.getKuzzleState()
    };

    if (util.isError(error)) {
      log.object = { message: error.message, stack: error.stack };
    }
    else {
      log.object = error;
    }

    rp({
      url: 'http://' + process.env.LOG_ENGINE_HOST,
      method: 'GET',
      json: {message : log }
    });
  }


};
