var
  _ = require('lodash'),
  vm = require('vm'),
  InternalError = require('../../errors/internalError');


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


module.exports = Role;
