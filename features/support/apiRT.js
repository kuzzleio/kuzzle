/**
 * This file contains the main API method for real-time protocols.
 * Avoid to add a new function in each api protocols when a new action in Kuzzle is added.
 *
 * NOTE: must be added in api REST because the apiREST file doesn't extend this ApiRT
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
      controller: 'write',
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
      controller: 'write',
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
      controller: 'write',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'createOrReplace',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.replace = function (body, index, collection) {
  var
    msg = {
      controller: 'write',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'replace',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.get = function (id, index) {
  var
    msg = {
      controller: 'read',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'get',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.search = function (filters, index, collection) {
  var
    msg = {
      controller: 'read',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'search',
      body: filters
    };

  return this.send(msg);
};

ApiRT.prototype.count = function (filters, index, collection) {
  var
    msg = {
      controller: 'read',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'count',
      body: filters
    };

  return this.send(msg);
};

ApiRT.prototype.update = function (id, body, index) {
  var
    msg = {
      controller: 'write',
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
      controller: 'write',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'delete',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.deleteByQuery = function (filters, index, collection) {
  var
    msg = {
      controller: 'write',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'deleteByQuery',
      body: filters
    };

  return this.send(msg);
};

ApiRT.prototype.updateMapping = function (index) {
  var
    msg = {
      controller: 'admin',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'updateMapping',
      body: this.world.schema
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
      controller: 'subscribe',
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      action: 'on',
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
      controller: 'subscribe',
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      action: 'off',
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
      controller: 'subscribe',
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
      controller: 'admin',
      action: 'getStats',
      body: dates
    };

  return this.send(msg);
};

ApiRT.prototype.getLastStats = function () {
  var
    msg = {
      controller: 'admin',
      action: 'getLastStats'
    };

  return this.send(msg);
};

ApiRT.prototype.getAllStats = function () {
  var
    msg = {
      controller: 'admin',
      action: 'getAllStats'
    };

  return this.send(msg);
};

ApiRT.prototype.listCollections = function (index, type) {
  var
    msg = {
      controller: 'read',
      index: index || this.world.fakeIndex,
      action: 'listCollections',
      body: {type}
    };

  return this.send(msg);
};

ApiRT.prototype.now = function () {
  var
    msg = {
      controller: 'read',
      action: 'now'
    };

  return this.send(msg);
};

ApiRT.prototype.truncateCollection = function (index, collection) {
  var
    msg = {
      controller: 'admin',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'truncateCollection'
    };

  return this.send(msg);
};

ApiRT.prototype.listSubscriptions = function () {
  var
    msg = {
      controller: 'subscribe',
      action: 'list'
    };

  return this.send(msg);
};

ApiRT.prototype.deleteIndexes = function () {
  var
    msg = {
      controller: 'admin',
      action: 'deleteIndexes'
    };

  return this.send(msg);
};

ApiRT.prototype.listIndexes = function () {
  var
    msg = {
      controller: 'read',
      action: 'listIndexes'
    };

  return this.send(msg);
};

ApiRT.prototype.createIndex = function (index) {
  var
    msg = {
      controller: 'admin',
      action: 'createIndex',
      index: index
    };

  return this.send(msg);
};

ApiRT.prototype.deleteIndex = function (index) {
  var
    msg = {
      controller: 'admin',
      action: 'deleteIndex',
      index: index
    };

  return this.send(msg);
};

ApiRT.prototype.removeRooms = function (rooms, index) {
  var
    msg = {
      controller: 'admin',
      action: 'removeRooms',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      body: {rooms: rooms}
    };

  return this.send(msg);
};

ApiRT.prototype.getServerInfo = function () {
  var
    msg = {
      controller: 'read',
      action: 'serverInfo',
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
      headers: {
        authorization: 'Bearer ' + jwtToken
      }
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
      filter: body
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
    controller: 'admin',
    action: 'refreshIndex'
  });
};

ApiRT.prototype.callMemoryStorage = function (command, args) {
  return this.send(_.extend({
    controller: 'ms',
    action: command
  }, args));
};

ApiRT.prototype.setAutoRefresh = function (index, autoRefresh) {
  return this.send({
    index: index,
    controller: 'admin',
    action: 'setAutoRefresh',
    body: {
      autoRefresh: autoRefresh
    }
  });
};

ApiRT.prototype.getAutoRefresh = function (index) {
  return this.send({
    index: index,
    controller: 'admin',
    action: 'getAutoRefresh'
  });
};

module.exports = ApiRT;
