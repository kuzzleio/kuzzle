var
  _ = require('lodash'),
  http = require('http');


module.exports = logger =  {

  init: function () {
  },

  /**
   * return the process Data about Kuzzle
   */
  getProcessData: function(){

    var
      processData = {
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
  * send the request to Logstash
  * @param data the object message to send
  *
  */
  sendRequest: function(data){
    var postData = new Buffer(JSON.stringify(data)),
      req;
    req = http.request({
      host: "logstash", port : '7777',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
        }
      },
      function(){
          req.end();
      });

    req.retry = 0;

    req.on('error',function(e){
      req.retry++;
      //some request are not send, do 4 retry.
      if(req.retry < 4){
        setTimeout(function(){
          req.write(postData);
        },0);
      }
      else {
          console.log("error from logstash for request  " + e.message +  "  retry " + req.retry);
          req.end();
        }
    });
    req.write(postData);
  },


  /**
   * send data from log with kuzzle state
   * @param object a RequestObject,  or relevant info for event
   * @param hookEvent hook from log  (exemple : "data:delete")
   * @param metaData (optional) metaData (for kuzzle, the nbRooms, the nbCustomers,...)
   */
  log: function (object, hookEvent, metaData) {
    var data = {},
      log;

    if(object){
      if(object.duration){
        data.duration = object.duration;
      }
      if(object.requestId){
        data.requestId = object.requestId;
      }
    }

    log = {
      hookEvent : hookEvent,
      processData : this.getProcessData(),
      object : data,
      timestamp : Date.now(),
      metaData : metaData
    };

    this.sendRequest({message : log})
  },


  /**
   * send data from log with kuzzle state
   * @param error a Native Error (exemple : new Error("my Error"))
   * @param hookEvent hook from log (exemple : "data:delete")
   * @param metaData (optional) metaData (for kuzzle, the nbRooms, the nbCustomers,...)
   */
  error: function (error, hookEvent, metaData) {
    var data = {},
      log;
    log = {
      hookEvent : hookEvent,
      processData : this.getProcessData(),
      timestamp : Date.now(),
      metaData : metaData
    };

    if(error instanceof Error)
      log.object = { message: error.message, stack: error.stack };

    this.sendRequest({message : log})
  }
};
