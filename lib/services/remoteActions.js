module.exports = remoteActions = {

  kuzzle: null,
  taskQueue: 'remote_action',
  uniquetaskQueue: 'remote_action_' + process.pid,

  /**
   * @param kuzzle
   */
  init: function (kuzzle) {
    remoteActions.kuzzle = kuzzle;

    remoteActions.kuzzle.services.list.broker.listen(remoteActions.taskQueue, onListenCB.bind(this));
    remoteActions.kuzzle.services.list.broker.listen(remoteActions.uniquetaskQueue, onListenCB.bind(this));
  },

  actions: {
    activeNewrelic: function () {

    }
  }

};

function onListenCB (data) {
}
