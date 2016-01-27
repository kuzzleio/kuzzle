var
  _ = require('lodash'),
  q = require('q'),
  vm = require('vm'),
  BadRequestError = require('../../errors/badRequestError'),
  InternalError = require('../../errors/internalError'),
  Sandbox = require('../../sandbox'),
  internalIndex = require('rc')('kuzzle').internalIndex;

function Role () {
  this.indexes = {};
  this.closures = {};
}

function doesIndexExist(requestObject, indexes) {
  return indexes[requestObject.index] !== undefined;
}

function doesCollectionExist(requestObject, indexes) {
  return _.contains(indexes[requestObject.index], requestObject.collection);
}

/**
 * @param requestObject
 * @param context
 * @param indexes
 * @returns {*}
 */
Role.prototype.isActionAllowed = function (requestObject, context, indexes) {
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

  /*
   Security controller's routes are only applicable on the internal index.
   Therefore, the "index" argument is not expected in the request object.
    */
  if (requestObject.controller === 'security' && !this.indexes[internalIndex]) {
    return false;
  }

  if (this.indexes[requestObject.index] !== undefined) {
    indexRights = this.indexes[requestObject.index];
    path.push(requestObject.index);
  }
  // Wildcards doesn't resolve the internal index. The internal index must always be set explicitly
  else if (this.indexes['*'] !== undefined && internalIndex !== requestObject.index) {
    indexRights = this.indexes['*'];
    path.push('*');
  }
  else {
    return false;
  }

  if (this.indexes._canCreate !== undefined &&
    !this.indexes._canCreate &&
    _.contains(['import', 'create', 'createCollection', 'updateMapping', 'createOrReplace'], requestObject.action) &&
    !doesIndexExist(requestObject, indexes)) {
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

  if (indexRights.collections._canCreate !== undefined &&
    !indexRights.collections._canCreate &&
    _.contains(['import', 'create', 'createCollection', 'updateMapping', 'createOrReplace'], requestObject.action) &&
    !doesCollectionExist(requestObject, indexes)) {
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

  if (_.isBoolean(actionRights)) {
    // the role configuration is set to a static boolean. We return it as-is.
    return actionRights;
  }

  if (_.isString(actionRights)) {
    // the role configuration is a function. We assume it can be (almost) safely run
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

Role.prototype.validateDefinition = function (context) {
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

    if (indexKey === '_canCreate') {
      if (!_.isBoolean(indexRights)) {
        deferred.reject(new BadRequestError('Invalid index definition for ' + indexKey + '. Must be an boolean'));
        return false;
      }

      return true;
    }

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

      if (collectionKey === '_canCreate') {
        if (!_.isBoolean(collectionRights)) {
          deferred.reject(new BadRequestError('Invalid index definition for ' + [indexKey, collectionKey] + '. Must be an boolean'));
          return false;
        }

        return true;
      }
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
              var
                sandBox = new Sandbox();

              return sandBox.run({
                sandbox: {
                  requestObject: {
                    index: 'index',
                    collection: 'collection',
                    controller: 'controller',
                    action: 'action',
                    data: {
                      _id: -1,
                      body: {
                        a: true
                      }
                    }
                  },
                  context: {
                    connection: {type: context.connection.type},
                    token: context.token
                  }
                },
                code: '(function (requestObject, context) { ' + actionRights + '\nreturn false;\n})(requestObject, context)'
              })
              .then(result => {
                var error;

                if (result.result !== undefined && _.isBoolean(result.result)) {
                  return q(result.result);
                }

                error = new BadRequestError('Invalid definition for '+ [indexKey, collectionKey, controllerKey, actionKey] + '. Error executing function');
                error.detail = result.err;

                return q.reject(error);
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
