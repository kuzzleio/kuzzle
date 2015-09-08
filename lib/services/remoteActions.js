module.exports = remoteActions = {
  kuzzle: null,
  uniquetaskQueue: null,

  /**
   * @param kuzzle
   */
  init: function (kuzzle) {
    remoteActions.kuzzle = kuzzle;
    remoteActions.uniquetaskQueue = kuzzle.config.queues.remoteActionQueue + '-' + process.pid;

    remoteActions.kuzzle.services.list.broker.listen(kuzzle.config.queues.remoteActionQueue, onListenCB.bind(this));
    remoteActions.kuzzle.services.list.broker.listen(remoteActions.uniquetaskQueue, onListenCB.bind(this));
  }
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

  if (!remoteActions.kuzzle.services.list[data.service]) {
    this.kuzzle.services.list.broker.add(data.id, {error: 'Unknown or deactivated service: ' + data.service});
    return false;
  }

  if (!remoteActions.kuzzle.services.list[data.service].toggle) {
    this.kuzzle.services.list.broker.add(data.id, {error: 'The service ' + data.service + ' doesn\'t support on-the-fly disabling/enabling'});
    return false;
  }

  remoteActions.kuzzle.services.list[data.service].toggle(data.enable)
    .then(function (message) {
      this.kuzzle.services.list.broker.add(data.id, {result: message});
    }.bind(this))
    .catch(function (error) {
      this.kuzzle.services.list.broker.add(data.id, {error: error.message});
    }.bind(this));
}
