var
  _ = require('lodash'),
  bunyan = require('bunyan'),
  fs = require('fs');


module.exports = logstash =  {
  logger: null,

  init: function () {
    if (fs.existsSync('/var/log/perf.log')) {
      fs.truncateSync('/var/log/perf.log', 0);
    }

    this.logger = bunyan.createLogger({
      name: 'myapp',
      streams: [{
        level: 'info',
        path: '/var/log/perf.log'
      }]
    });
  },

  /**
   * return the process Data about Kuzzle
   */
  getProcessData: function () {
    var
      processData = {
        pid : process.pid,
        memory: process.memoryUsage()
      };

    //undefined in non POSIX OS
    if (process.getgid) {
      processData.gid = process.getgid();
    }

    return processData;
  },

  /**
   * send data from log with kuzzle state
   * @param object a RequestObject,  or relevant info for event
   * @param hookEvent hook from log  (exemple : "write:rest:start")
   * @param metaData (optional) metaData (for kuzzle, the nbRooms, the nbCustomers,...)
   */
  log: function (object, hookEvent, metaData) {
    var
      message = {
        message: {
          hookEvent: hookEvent,
          processData: this.getProcessData(),
          object: object,
          timestamp: Date.now(),
          metaData: metaData
        }
      };

    this.logger.info(message);
  },

  /**
   * send error log
   * @param error a Native Error (exemple : new Error("my Error"))
   * @param hookEvent hook from log (exemple : "data:delete")
   * @param metaData (optional) metaData (for kuzzle the current nbRooms, nbCustomers,..., for a worker it will be his id...)
   */
  error: function (error, hookEvent, metaData) {
    var
      message = {
        hookEvent : hookEvent,
        processData : this.getProcessData(),
        timestamp : Date.now(),
        metaData : metaData
      };

    if (error instanceof Error) {
      message.object = {message: error.message, stack: error.stack };
    }

    this.toto.info(message);
  }
};
