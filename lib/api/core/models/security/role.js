var
  _ = require('lodash'),
  q = require('q'),
  vm = require('vm'),
  BadRequestError = require('../../errors/badRequestError'),
  InternalError = require('../../errors/internalError'),
  SandBox = require('../../sandbox');


function Role () {
  this.indexes = {};
  this.closures = {};
}

Role.prototype.isActionAllowed = function (requestObject, context) {
  var
    indexRights,
    collectionRights,
    controllerRights,
    actionRights,
    path = [],
    sandboxContext,
    sandboxScript,
    error;

  if (this.indexes === undefined) {
    return false;
  }

  if (this.indexes[requestObject.index] !== undefined) {
    indexRights = this.indexes[requestObject.index];
    path.push(requestObject.index);
  }
  else if (this.indexes['*'] !== undefined) {
    indexRights = this.indexes['*'];
    path.push('*');
  }
  else {
    return false;
  }

  if (indexRights.collections === undefined) {
    return false;
  }

  if (indexRights.collections[requestObject.collection] !== undefined) {
    collectionRights = indexRights.collections[requestObject.collection];
    path.push(requestObject.collection);
  }
  else if (indexRights.collections['*'] !== undefined) {
    collectionRights = indexRights.collections['*'];
    path.push('*');
  }
  else {
    return false;
  }

  if (collectionRights.controllers === undefined) {
    return false;
  }

  if (collectionRights.controllers[requestObject.controller] !== undefined) {
    controllerRights = collectionRights.controllers[requestObject.controller];
    path.push(requestObject.controller);
  }
  else if (collectionRights.controllers['*'] !== undefined) {
    controllerRights = collectionRights.controllers['*'];
    path.push('*');
  }
  else {
    return false;
  }

  if (controllerRights.actions === undefined) {
    return false;
  }

  if (controllerRights.actions[requestObject.action] !== undefined) {
    actionRights = controllerRights.actions[requestObject.action];
    path.push(requestObject.action);
  }
  else if (controllerRights.actions['*'] !== undefined) {
    actionRights = controllerRights.actions['*'];
    path.push('*');
  }
  else {
    return false;
  }

  if (actionRights === true || actionRights === false) {
    // the role configuration is set to a static boolean. We return it as-is.
    return actionRights;
  }

  if (_.isString(actionRights)) {
    // the role configuration is a function. We assume it can be safely run
    // as it should have previously been validated during creation.

    sandboxContext = vm.createContext({ requestObject: requestObject, context: context });

    if (this.closures[path] === undefined) {
      try {
        sandboxScript = new vm.Script('(function (requestObject, context) { ' + actionRights + '\nreturn false;\n })(requestObject, context)');
        this.closures[path] = sandboxScript;
      }
      catch (err) {
        error = new InternalError('Error parsing rights for role ' + this._id + ' (' + path.join('/') + ') :' + actionRights);
        error.details = err;

        throw (error);
      }
    }

    return this.closures[path].runInContext(sandboxContext);
  }

  throw (new InternalError('Invalid rights given for role ' + this._id + '(' + path.join('/') + ') : ' + actionRights));
};

Role.prototype.validateDefinition = function () {
  var
    deferred = q.defer(),
    promises = [];

  if (!_.isObject(this.indexes)) {
    return q.reject(new BadRequestError('The index definition must be an object'));
  }
  if (_.isEmpty(this.indexes)) {
    return q.reject(new BadRequestError('The index definition cannot be empty'));
  }

  Object.keys(this.indexes).every(indexKey => {
    var indexRights = this.indexes[indexKey];
    
    if (!_.isObject(indexRights)) {
      deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. Must be an object'));
      return false;
    }
    if (_.isEmpty(indexRights)) {
      deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. Cannot be empty'));
      return false;
    }
    if (indexRights.collections === undefined) {
      deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. `collections` attribute missing'));
      return false;
    }
    if (!_.isObject(indexRights.collections)) {
      deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. `collections` attribute must be an object'));
      return false;
    }
    if (_.isEmpty(indexRights.collections)) {
      deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. `collections` attribute cannot be empty'));
      return false;
    }
    
    Object.keys(indexRights.collections).every(collectionKey => {
      var collectionRights = indexRights.collections[collectionKey];
      
      if (!_.isObject(collectionRights)) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey] + '. Must be an object'));
        return false;
      }
      if (_.isEmpty(collectionRights)) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey] + '. Cannot be empty'));
        return false;
      }
      if (collectionRights.controllers === undefined) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey] + '. `controllers` attribute missing'));
        return false;
      }
      if (!_.isObject(collectionRights.controllers)) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey] + '. `controllers` attribute must be an object'));
        return false;
      }
      if (_.isEmpty(collectionRights.controllers)) {
        deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey] + '. `controllers` attribute cannot be empty'));
        return false;
      }

      Object.keys(collectionRights.controllers).every(controllerKey => {
        var controllerRights = collectionRights.controllers[controllerKey];

        if (!_.isObject(controllerRights)) {
          deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey] + '. Must be an object'));
          return false;
        }
        if (_.isEmpty(controllerRights)) {
          deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey] + '. Cannot be empty'));
          return false;
        }
        if (controllerRights.actions === undefined) {
          deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey] + '. `actions` attribute missing'));
          return false;
        }
        if (!_.isObject(controllerRights.actions)) {
          deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey] + '. `actions` attribute must be an object'));
          return false;
        }
        if (_.isEmpty(controllerRights.actions)) {
          deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey] + '. `actions` attribute cannot be empty'));
          return false;
        }

        Object.keys(controllerRights.actions).every(actionKey => {
          var actionRights = controllerRights.actions[actionKey];

          if (!_.isBoolean(actionRights) && !_.isString(actionRights)) {
            deferred.reject(new BadRequestError('Invalid definition for ' + [indexKey, collectionKey, controllerKey, actionKey] + '. Must be a boolean or a string'));
            return false;
          }

          if (_.isString(actionRights)) {
            promises.push((function () {
              var sandBox = new SandBox();
              return sandBox.run({
                sandbox: {
                  requestObject: {
                    index: 'index',
                    collection: 'collection',
                    controller: 'controller',
                    action: 'action'
                  },
                  context: {
                    connection: null,
                    user: null
                  }
                },
                code: '(function (requestObject, context) { ' + actionRights + '\nreturn false;\n})(requestObject, context)'
              })
              .then(result => {
                var error;

                if (result.result !== undefined && _.isBoolean(result.result)) {
                  return Promise.resolve(result.result);
                }

                error = new BadRequestError('Invalid definition for '+ [indexKey, collectionKey, controllerKey, actionKey] + '. Error executing function');
                error.detail = result.err;

                return Promise.reject(error);
              });
            })());
          }

          return true;
        });

        return true;
      });

      return true;
    });

    return true;
  });

  if (promises.length > 0) {
    q.all(promises)
      .then(() => {
        deferred.resolve(true);
      })
      .catch(error => {
        deferred.reject(error);
      });
  }
  else {
    deferred.resolve(true);
  }

  return deferred.promise;
};

module.exports = Role;
