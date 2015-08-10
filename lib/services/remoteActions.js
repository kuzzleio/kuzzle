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
  },

  actions: {
    profiling: function (enable) {
      remoteActions.kuzzle.services.list.profiling.toggle(enable);
    }
  }

};

function onListenCB (data) {
  if (!data.id) {
    return false;
  }

  if (!data.service || data.enable === undefined) {
    this.kuzzle.services.list.broker.add(data.id, {error: 'Not enough information are sent: missing service or enable true/false'});
    return false;
  }

  if (!remoteActions.actions[data.service]) {
    this.kuzzle.services.list.broker.add(data.id, {error: 'The action on service ' + data.service + ' is undefined or not allowed'});
    return false;
  }

  remoteActions.actions[data.service](data.enable);
  this.kuzzle.services.list.broker.add(data.id, true);
}
