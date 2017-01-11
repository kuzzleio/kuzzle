/**
 * This file contains the main API method for real-time protocols.
 * Avoid to add a new function in each api protocols when a new action in Kuzzle is added.
 *
 * NOTE: must be added in api HTTP because the apiHttp file doesn't extend this ApiRT
 */

var
  _ = require('lodash'),
  ApiRT = function () {
    this.world = null;
    this.clientId = null;
    this.subscribedRooms = {};
    this.responses = null;
  };

ApiRT.prototype.send = function () {};
ApiRT.prototype.sendAndListen = function () {};

ApiRT.prototype.create = function (body, index, collection, jwtToken) {
  var
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'create',
      body: body
    };

  if (jwtToken !== undefined) {
    msg.headers = {
      authorization :'Bearer ' + jwtToken
    };
  }

  return this.send(msg);
};

ApiRT.prototype.publish = function (body, index) {
  var
    msg = {
      controller: 'realtime',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'publish',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.createOrReplace = function (body, index, collection) {
  var
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'createOrReplace',
      body: body
    };

  if (body._id) {
    msg._id = body._id;
    delete body._id;
  }

  return this.send(msg);
};

ApiRT.prototype.replace = function (body, index, collection) {
  var
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'replace',
      body: body
    };

  if (body._id) {
    msg._id = body._id;
    delete body._id;
  }

  return this.send(msg);
};

ApiRT.prototype.get = function (id, index) {
  var
    msg = {
      controller: 'document',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'get',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.search = function (query, index, collection, args) {
  var
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'search',
      body: query
    };

  _.forEach(args, (item, k) => {
    msg[k] = item;
  });

  return this.send(msg);
};

ApiRT.prototype.scroll = function (scrollId) {
  var
    msg = {
      controller: 'document',
      action: 'scroll',
      scrollId
    };

  return this.send(msg);
};

ApiRT.prototype.count = function (query, index, collection) {
  var
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'count',
      body: query
    };

  return this.send(msg);
};

ApiRT.prototype.update = function (id, body, index) {
  var
    msg = {
      controller: 'document',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'update',
      _id: id,
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.deleteById = function (id, index) {
  var
    msg = {
      controller: 'document',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'delete',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.deleteByQuery = function (query, index, collection) {
  var
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'deleteByQuery',
      body: query
    };

  return this.send(msg);
};

ApiRT.prototype.updateMapping = function (index) {
  var
    msg = {
      controller: 'collection',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'updateMapping',
      body: this.world.schema
    };

  return this.send(msg);
};

ApiRT.prototype.getProfileMapping = function () {
  var
    msg = {
      controller: 'security',
      action: 'getProfileMapping'
    };

  return this.send(msg);
};

ApiRT.prototype.updateProfileMapping = function () {
  var
    msg = {
      controller: 'security',
      action: 'updateProfileMapping',
      body: this.world.securitySchema
    };

  return this.send(msg);
};

ApiRT.prototype.getRoleMapping = function () {
  var
    msg = {
      controller: 'security',
      action: 'getRoleMapping'
    };

  return this.send(msg);
};

ApiRT.prototype.updateRoleMapping = function () {
  var
    msg = {
      controller: 'security',
      action: 'updateRoleMapping',
      body: this.world.securitySchema
    };

  return this.send(msg);
};

ApiRT.prototype.getUserMapping = function () {
  var
    msg = {
      controller: 'security',
      action: 'getUserMapping'
    };

  return this.send(msg);
};

ApiRT.prototype.updateUserMapping = function () {
  var
    msg = {
      controller: 'security',
      action: 'updateUserMapping',
      body: this.world.securitySchema
    };

  return this.send(msg);
};

ApiRT.prototype.bulkImport = function (bulk, index, collection) {
  var
    msg = {
      controller: 'bulk',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'import',
      body: {bulkData: bulk}
    };

  return this.send(msg);
};

ApiRT.prototype.globalBulkImport = function (bulk) {
  var
    msg = {
      controller: 'bulk',
      action: 'import',
      body: {bulkData: bulk}
    };

  return this.send(msg);
};

ApiRT.prototype.subscribe = function (filters, client) {
  var
    msg = {
      controller: 'realtime',
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      action: 'subscribe',
      users: 'all',
      body: null
    };

  if (filters) {
    msg.body = filters;
  }

  return this.sendAndListen(msg, client);
};

ApiRT.prototype.unsubscribe = function (room, clientId) {
  var
    msg = {
      clientId: clientId,
      controller: 'realtime',
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      action: 'unsubscribe',
      body: { roomId: room }
    };

  this.subscribedRooms[clientId][room].close();
  delete this.subscribedRooms[clientId];

  return this.send(msg, false);
};

ApiRT.prototype.countSubscription = function () {
  var
    clients = Object.keys(this.subscribedRooms),
    rooms = Object.keys(this.subscribedRooms[clients[0]]),
    msg = {
      controller: 'realtime',
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      action: 'count',
      body: {
        roomId: rooms[0]
      }
    };

  return this.send(msg);
};

ApiRT.prototype.getStats = function (dates) {
  var
    msg = {
      controller: 'server',
      action: 'getStats',
      body: dates
    };

  return this.send(msg);
};

ApiRT.prototype.getLastStats = function () {
  var
    msg = {
      controller: 'server',
      action: 'getLastStats'
    };

  return this.send(msg);
};

ApiRT.prototype.getAllStats = function () {
  var
    msg = {
      controller: 'server',
      action: 'getAllStats'
    };

  return this.send(msg);
};

ApiRT.prototype.listCollections = function (index, type) {
  var
    msg = {
      controller: 'collection',
      index: index || this.world.fakeIndex,
      action: 'list',
      body: {type}
    };

  return this.send(msg);
};

ApiRT.prototype.now = function () {
  var
    msg = {
      controller: 'server',
      action: 'now'
    };

  return this.send(msg);
};

ApiRT.prototype.truncateCollection = function (index, collection) {
  var
    msg = {
      controller: 'collection',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'truncate'
    };

  return this.send(msg);
};

ApiRT.prototype.listSubscriptions = function () {
  var
    msg = {
      controller: 'realtime',
      action: 'list'
    };

  return this.send(msg);
};

ApiRT.prototype.deleteIndexes = function () {
  var
    msg = {
      controller: 'index',
      action: 'mdelete'
    };

  return this.send(msg);
};

ApiRT.prototype.listIndexes = function () {
  var
    msg = {
      controller: 'index',
      action: 'list'
    };

  return this.send(msg);
};

ApiRT.prototype.createIndex = function (index) {
  var
    msg = {
      controller: 'index',
      action: 'create',
      index: index
    };

  return this.send(msg);
};

ApiRT.prototype.deleteIndex = function (index) {
  var
    msg = {
      controller: 'index',
      action: 'delete',
      index: index
    };

  return this.send(msg);
};

ApiRT.prototype.getServerInfo = function () {
  var
    msg = {
      controller: 'server',
      action: 'info',
      body: {}
    };

  return this.send(msg);
};

ApiRT.prototype.login = function (strategy, credentials) {
  var
    msg = {
      controller: 'auth',
      action: 'login',
      body: {
        strategy: strategy,
        username: credentials.username,
        password: credentials.password,
        expiresIn: credentials.expiresIn
      }
    };

  return this.send(msg);
};

ApiRT.prototype.logout = function(jwtToken) {
  var
    msg = {
      controller: 'auth',
      action: 'logout',
      jwt: jwtToken
    };

  return this.send(msg);
};

ApiRT.prototype.createOrReplaceRole = function (id, body) {
  var
    msg = {
      controller: 'security',
      action: 'createOrReplaceRole',
      _id: id,
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.getRole = function (id) {
  var
    msg = {
      controller: 'security',
      action: 'getRole',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.mGetRoles = function (body) {
  var
    msg = {
      controller: 'security',
      action: 'mGetRoles',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.searchRoles = function (body) {
  var
    msg = {
      controller: 'security',
      action: 'searchRoles',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.deleteRole = function (id) {
  var
    msg = {
      controller: 'security',
      action: 'deleteRole',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.createOrReplaceRole = function (id, body) {
  var
    msg = {
      controller: 'security',
      action: 'createOrReplaceRole',
      _id: id,
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.getProfile = function (id) {
  var
    msg = {
      controller: 'security',
      action: 'getProfile',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.getProfileRights = function (id) {
  var
    msg = {
      controller: 'security',
      action: 'getProfileRights',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.mGetProfiles = function (body) {
  var
    msg = {
      controller: 'security',
      action: 'mGetProfiles',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.createOrReplaceProfile = function (id, body) {
  var
    msg = {
      controller: 'security',
      action: 'createOrReplaceProfile',
      _id: id,
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.searchProfiles = function (body) {
  var
    msg = {
      controller: 'security',
      action: 'searchProfiles',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.deleteProfile = function (id) {
  var
    msg = {
      controller: 'security',
      action: 'deleteProfile',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.searchValidations = function (body) {
  var
    msg = {
      controller: 'collection',
      action: 'searchSpecifications',
      body
    };

  return this.send(msg);
};

ApiRT.prototype.getUser = function (id) {
  return this.send({
    controller: 'security',
    action: 'getUser',
    _id: id
  });
};

ApiRT.prototype.getUserRights = function (id) {
  return this.send({
    controller: 'security',
    action: 'getUserRights',
    _id: id
  });
};

ApiRT.prototype.getCurrentUser = function () {
  return this.send({
    controller: 'auth',
    action: 'getCurrentUser'
  });
};

ApiRT.prototype.getMyRights = function (id) {
  return this.send({
    controller: 'auth',
    action: 'getMyRights',
    _id: id
  });
};

ApiRT.prototype.searchUsers = function (body) {
  return this.send({
    controller: 'security',
    action: 'searchUsers',
    body: {
      query: body
    }
  });
};

ApiRT.prototype.deleteUser = function (id) {
  return this.send({
    controller: 'security',
    action: 'deleteUser',
    _id: id
  });
};

ApiRT.prototype.createOrReplaceUser = function (body, id) {
  return this.send({
    controller: 'security',
    action: 'createOrReplaceUser',
    body: body,
    _id: id
  });
};

ApiRT.prototype.updateSelf = function (body) {
  return this.send({
    controller: 'auth',
    action: 'updateSelf',
    body: body
  });
};

ApiRT.prototype.createUser = function (body, id) {
  var msg = {
    controller: 'security',
    action: 'createUser',
    body: body
  };
  if (id !== undefined) {
    msg._id = id;
  }

  return this.send(msg);
};

ApiRT.prototype.createRestrictedUser = function (body, id) {
  var msg = {
    controller: 'security',
    action: 'createRestrictedUser',
    body: body
  };
  if (id !== undefined) {
    msg._id = id;
  }

  return this.send(msg);
};

ApiRT.prototype.checkToken = function (token) {
  return this.send({
    controller: 'auth',
    action: 'checkToken',
    body: {token}
  });
};

ApiRT.prototype.refreshIndex = function (index) {
  return this.send({
    index: index,
    controller: 'index',
    action: 'refresh'
  });
};

ApiRT.prototype.callMemoryStorage = function (command, args) {
  var msg = {
    controller: 'ms',
    action: command
  };
  _.forEach(args, (value, prop) => {
    if (prop === 'args') {
      _.forEach(value, (item, k) => {
        msg[k] = item;
      });
    } else {
      msg[prop] = value;
    }
  });

  return this.send(msg);
};

ApiRT.prototype.setAutoRefresh = function (index, autoRefresh) {
  return this.send({
    index: index,
    controller: 'index',
    action: 'setAutoRefresh',
    body: {
      autoRefresh: autoRefresh
    }
  });
};

ApiRT.prototype.getAutoRefresh = function (index) {
  return this.send({
    index: index,
    controller: 'index',
    action: 'getAutoRefresh'
  });
};

ApiRT.prototype.indexExists = function (index) {
  return this.send({
    index,
    controller: 'index',
    action: 'exists'
  });
};

ApiRT.prototype.collectionExists = function (index, collection) {
  return this.send({
    index,
    collection,
    controller: 'collection',
    action: 'exists'
  });
};

ApiRT.prototype.getSpecifications = function (index, collection) {
  return this.send({
    index: index,
    collection: collection,
    controller: 'collection',
    action: 'getSpecifications'
  });
};

ApiRT.prototype.updateSpecifications = function (specifications) {
  return this.send({
    index: null,
    collection: null,
    controller: 'collection',
    action : 'updateSpecifications',
    body: specifications
  });
};

ApiRT.prototype.validateSpecifications = function (specifications) {
  return this.send({
    index: null,
    collection: null,
    controller: 'collection',
    action : 'validateSpecifications',
    body: specifications
  });
};

ApiRT.prototype.validateDocument = function (index, collection, document) {
  return this.create(document, index, collection);
};

ApiRT.prototype.deleteSpecifications = function (index, collection) {
  return this.send({
    index: index,
    collection: collection,
    controller: 'collection',
    action : 'deleteSpecifications',
    body: null
  });
};

ApiRT.prototype.postDocument = function (index, collection, document) {
  return this.send({
    index,
    collection,
    controller: 'document',
    action: 'create',
    body: document
  });
};

module.exports = ApiRT;
