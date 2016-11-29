var
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Request = require('kuzzle-common-objects').Request;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function CliController (kuzzle) {
  this.init = () => {
    this.actions = {
      adminExists: kuzzle.funnel.controllers.admin.adminExists,
      createFirstAdmin: kuzzle.funnel.controllers.admin.createFirstAdmin,
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
    var
      request = new Request(payload.data, payload.options);

    if (!this.actions[request.action]) {
      request.setError(new NotFoundError('The action "' + request.action + '" does not exist.'));

      return kuzzle.services.list.broker.send(request.requestId, request.serialize());
    }

    return this.actions[request.action](request)
      .then(response => {
        request.setResult(response);

        return kuzzle.services.list.broker.send(request.requestId, request.serialize());
      })
      .catch(error => {
        request.setError(error);

        return kuzzle.services.list.broker.send(request.requestId, request.serialize());
      });
  };
}

module.exports = CliController;
