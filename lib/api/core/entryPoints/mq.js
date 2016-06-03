/**
 * Asks the router controller to start listening to messages coming from RabbitMQ
 * @param kuzzle
 */
function MQListener (kuzzle) {
  this.kuzzle = kuzzle;
}

MQListener.prototype.init = function () {
  this.kuzzle.router.routeMQListener();

  this.kuzzle.pluginsManager.trigger('server:mqStarted', 'Starting: MQ listener');
};

module.exports = MQListener;