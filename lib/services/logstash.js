var
  bunyan = require('bunyan'),
  fs = require('fs');


module.exports = function () {
  this.logger = null;

  this.init = function () {
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
  };

  /**
   * return the process Data about Kuzzle
   */
  this.getProcessData = function () {
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
  };

  /**
   * send data from log with kuzzle state
   * @param object a relevant object about the log with duration and testingParam
   * @param hookEvent hook from log  (exemple : "write:rest:start")
   * @param metaData (optional) metaData (for kuzzle, the nbRooms, the nbCustomers,...)
   */
  this.log = function (object, hookEvent, metaData) {
    var
      log = object || {},
      message = {
        message: {
          hookEvent: hookEvent,
          duration : log.duration,
          processData: this.getProcessData(),
          timestamp: Date.now(),
          metaData: metaData
        }
      };

    this.logger.info(message);
  };

  /**
   * send error log
   * @param error a Native Kuzzle Error (exemple : new InternalError("my Error"))
   * @param hookEvent hook from log (exemple : "data:delete")
   * @param metaData (optional) metaData (for kuzzle the current nbRooms, nbCustomers,..., for a worker it will be his id...)
   */
  this.error = function (error, hookEvent, metaData) {
    var
      message = {
        hookEvent : hookEvent,
        processData : this.getProcessData(),
        timestamp : Date.now(),
        metaData : metaData
      };

    if (error instanceof Error) {
      message.object = {status: error.status, message: error.message, stack: error.stack };
    }

    this.logger.info(message);
  };
};
