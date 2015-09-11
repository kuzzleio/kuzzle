module.exports = function (kuzzle) {
  this.kuzzle = kuzzle;
  this.uniquetaskQueue = null;

  /**
   * @param kuzzle
   */
  this.init = function () {
    this.uniquetaskQueue = this.kuzzle.config.queues.remoteActionQueue + '-' + process.pid;

    this.kuzzle.services.list.broker.listen(this.kuzzle.config.queues.remoteActionQueue, onListenCB.bind(this));
    this.kuzzle.services.list.broker.listen(this.uniquetaskQueue, onListenCB.bind(this));
  };
};

function onListenCB (data) {
  if (!data.id) {
    return false;
  }

  if (!data.service) {
    this.kuzzle.services.list.broker.add(data.id, {error: 'Missing service name'});
    return false;
  }

  if (data.enable === undefined) {
    this.kuzzle.services.list.broker.add(data.id, {error: 'Missing enable/disable tag'});
    return false;
  }

  if (!this.kuzzle.services.list[data.service]) {
    this.kuzzle.services.list.broker.add(data.id, {error: 'Unknown or deactivated service: ' + data.service});
    return false;
  }

  if (!this.kuzzle.services.list[data.service].toggle) {
    this.kuzzle.services.list.broker.add(data.id, {error: 'The service ' + data.service + ' doesn\'t support on-the-fly disabling/enabling'});
    return false;
  }

  this.kuzzle.services.list[data.service].toggle(data.enable)
    .then(function (message) {
      this.kuzzle.services.list.broker.add(data.id, {result: message});
    }.bind(this))
    .catch(function (error) {
      this.kuzzle.services.list.broker.add(data.id, {error: error.message});
    }.bind(this));
}
