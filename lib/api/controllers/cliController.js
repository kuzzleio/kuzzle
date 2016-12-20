var
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Request = require('kuzzle-common-objects').Request;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function CliController (kuzzle) {
  this.kuzzle = kuzzle;

  this.init = () => {
    this.actions = {
      adminExists: request => kuzzle.funnel.controllers.server.adminExists(request),
      createFirstAdmin: request => kuzzle.funnel.controllers.security.createFirstAdmin(request),
      cleanDb: require('./cli/cleanDb')(kuzzle),
      clearCache: require('./cli/clearCache')(kuzzle),
      dump:require('./cli/dump')(kuzzle),
      data: require('./cli/data')(kuzzle),
      managePlugins: require('./cli/managePlugins')(kuzzle)
    };

    kuzzle.services.list.broker.listen(kuzzle.config.queues.cliQueue, this.onListenCB);
    kuzzle.pluginsManager.trigger('log:info', 'CLI controller initialized');
  };

  this.onListenCB = (payload) => {
    var request = new Request(payload.data, payload.options);

    if (!request.input.action || !this.actions[request.input.action]) {
      request.setError(new NotFoundError('The action "' + request.input.action + '" does not exist.'));

      return kuzzle.services.list.broker.send(request.id, request.serialize());
    }

    return this.actions[request.input.action](request)
      .then(response => {
        request.setResult(response);

        return kuzzle.services.list.broker.send(request.id, request.serialize());
      })
      .catch(error => {
        request.setError(error);

        return kuzzle.services.list.broker.send(request.id, request.serialize());
      });
  };
}

module.exports = CliController;
