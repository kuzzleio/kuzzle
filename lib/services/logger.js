var
  rp = require('request-promise'),
  _ = require('lodash'),
  util = require('util');


module.exports = logger =  {

  init: function () {
  },

  /**
   * return the process Data about Kuzzle
   */
  getProcessData: function(){
    var processData = {

      pid : process.pid,
      memory: process.memoryUsage()
    };

    //undefined in non POSIX OS
    if(process.getgid){
      processData.gid = process.getgid();
    }
    return processData;
  },

  /**
   * send data from log with kuzzle state
   * @param object a RequestObject,  or relevant info for event
   * @param hookEvent hook from log  (exemple : "data:delete")
   * @param metaData (optional) metaData (for kuzzle, the nbRooms, the nbCustomers,...)
   */
  log: function (object, hookEvent, metaData) {
    var dataFromObject = {};
    if(object && object.duration){
      dataFromObject.duration = object.duration;
    }

    var log = {
      hookEvent : hookEvent,
      processData : this.getProcessData(),
      dataFromObject : dataFromObject,
      timestamp : Date.now(),
      metaData : metaData
    };

    rp({
      url: 'http://' + process.env.LOG_ENGINE_HOST,
      method: 'GET',
      json: {message : log}
    });
  },

  error: function (error, hookEvent, metaData) {
    var log = {
      hookEvent : hookEvent,
      processData : this.getProcessData(),
      timestamp : Date.now(),
      metaData : metaData
    };

    rp({
      url: 'http://' + process.env.LOG_ENGINE_HOST,
      method: 'GET',
      json: {message : log}
    });
  }

};
