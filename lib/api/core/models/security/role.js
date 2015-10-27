function Role () {
  this.indexes = {};
}

Role.prototype.isActionAllowed = function (requestObject) {
  var
    indexRights,
    collectionRights,
    controllerRights,
    actionRights;

  if (this.indexes === undefined) {
    return false;
  }

  if (this.indexes[requestObject.index] !== undefined) {
    indexRights = this.indexes[requestObject.index];
  }
  else if (this.indexes['*'] !== undefined) {
    indexRights = this.indexes['*'];
  }
  else {
    return false;
  }

  if (indexRights.collections === undefined) {
    return false;
  }

  if (indexRights.collections[requestObject.collection] !== undefined) {
    collectionRights = indexRights.collections[requestObject.collection];
  }
  else if (indexRights.collections['*'] !== undefined) {
    collectionRights = indexRights.collections['*'];
  }
  else {
    return false;
  }

  if (collectionRights.controllers === undefined) {
    return false;
  }

  if (collectionRights.controllers[requestObject.controller] !== undefined) {
    controllerRights = collectionRights.controllers[requestObject.controller];
  }
  else if (collectionRights.controllers['*'] !== undefined) {
    controllerRights = collectionRights.controllers['*'];
  }
  else {
    return false;
  }

  if (controllerRights.actions === undefined) {
    return false;
  }

  if (controllerRights.actions[requestObject.action] !== undefined) {
    actionRights = controllerRights.actions[requestObject.action];
  }
  else if (controllerRights.actions['*'] !== undefined) {
    actionRights = controllerRights.actions['*'];
  }
  else {
    return false;
  }

  /* @TODO: implement custom function parsing */
  return actionRights;
};


module.exports = Role;
