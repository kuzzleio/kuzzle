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

  this.kuzzle.services.list.writeEngine[data.action](data)
    .then(function (result) {
      console.log(result);
    })
    .catch(function (error) {
      this.kuzzle.log.error(error);
    }.bind(this));
}