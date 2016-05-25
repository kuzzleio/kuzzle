/**
 * Asks the router controller to start listening to messages coming from RabbitMQ
 * @param kuzzle
 */
module.exports = function runMQListener (kuzzle) {
  kuzzle.router.routeMQListener();

  kuzzle.pluginsManager.trigger('server:mqStarted', 'Starting: MQ listener');
};