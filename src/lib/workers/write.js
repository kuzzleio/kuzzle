var
  q = require('q'),
  _ = require('lodash');

module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
    this.kuzzle.services.list.broker.init(kuzzle);

    this.listen();
  },

  add: function (data) {
    this.kuzzle.services.list.broker.add('task_queue', data);
  },

  listen: function () {
    this.kuzzle.services.list.broker.listen('task_queue', onListenCB.bind(this));
  },

  shutdown: function () {
    this.kuzzle.services.list.broker.close();
  }
};

function onListenCB (data) {
  if (data.persist === false) {
    return false;
  }

  if (typeof this.kuzzle.services.list.writeEngine[data.action] !== 'function') {
    return false;
  }

  this.kuzzle.services.list.writeEngine[data.action](_.clone(data))
    .then(function (result) {
      buildNotification.call(this, data, result)
        .then(function (notification) {
          //console.log(notification);
        })
        .catch(function (error) {

        });
      //this.kuzzle.services.list.broker.add('notify', );
    }.bind(this))
    .catch(function (error) {
      this.kuzzle.log.error(error);
    }.bind(this));
}

function buildNotification (data, writeResponse) {
  var
    deferred = q.defer(),
    requestGet;

  if (data.action === 'update') {
    requestGet = {
      collection: data.collection,
      id: writeResponse._id
    };

    this.kuzzle.services.list.readEngine.get(requestGet)
      .then(function (result) {
        data.body = result._source;
        deferred.resolve(data);
      })
      .catch(function (error) {
        deferred.reject(error);
      }.bind(this));
  }

  if (data.action === 'delete') {
    data.ids = writeResponse.ids;
  }

  deferred.resolve(data);
  return deferred.promise;
}