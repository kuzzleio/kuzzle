/**
 * This file contains the main API method for real-time protocols.
 * Avoid to add a new function in each api protocols when a new action in Kuzzle is added.
 *
 * NOTE: must be added in api HTTP because the apiHttp file doesn't extend this ApiRT
 */

const
  _ = require('lodash'),
  ApiRT = function () {
    this.world = null;
    this.clientId = null;
    this.subscribedRooms = {};
    this.responses = null;
  };

ApiRT.prototype.send = function () {};
ApiRT.prototype.sendAndListen = function () {};

ApiRT.prototype.create = function (body, index, collection, jwtToken, id) {
  const
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'create',
      body
    };

  if (id) {
    msg._id = id;
  }

  if (jwtToken !== undefined) {
    msg.headers = {
      authorization :'Bearer ' + jwtToken
    };
  }

  return this.send(msg);
};

ApiRT.prototype.mCreate = function (body, index, collection, jwtToken) {
  const
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'mCreate',
      body
    };

  if (jwtToken !== undefined) {
    msg.headers = {
      authorization :'Bearer ' + jwtToken
    };
  }

  return this.send(msg);
};

ApiRT.prototype.publish = function (body, index) {
  const
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
  const
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

ApiRT.prototype.mCreateOrReplace = function (body, index, collection) {
  const
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'mCreateOrReplace',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.replace = function (body, index, collection) {
  const
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

ApiRT.prototype.mReplace = function (body, index, collection) {
  const
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'mReplace',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.get = function (id, index) {
  const
    msg = {
      controller: 'document',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'get',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.mGet = function(body, index, collection) {
  const
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'mGet',
      body
    };

  return this.send(msg);
};

ApiRT.prototype.search = function (query, index, collection, args) {
  const
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

ApiRT.prototype.scroll = function (scrollId, scroll) {
  const
    msg = {
      controller: 'document',
      action: 'scroll',
      scrollId,
      scroll
    };

  return this.send(msg);
};

ApiRT.prototype.count = function (query, index, collection) {
  const
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
  const
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

ApiRT.prototype.mUpdate = function (body, index, collection) {
  const
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'mUpdate',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.deleteById = function (id, index) {
  const
    msg = {
      controller: 'document',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'delete',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.mDelete = function (body, index, collection) {
  const
    msg = {
      controller: 'document',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'mDelete',
      body
    };

  return this.send(msg);
};

ApiRT.prototype.deleteByQuery = function (query, index, collection) {
  const
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
  const
    msg = {
      controller: 'collection',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'updateMapping',
      body: this.world.mapping
    };

  return this.send(msg);
};

ApiRT.prototype.getProfileMapping = function () {
  const
    msg = {
      controller: 'security',
      action: 'getProfileMapping'
    };

  return this.send(msg);
};

ApiRT.prototype.updateProfileMapping = function () {
  const
    msg = {
      controller: 'security',
      action: 'updateProfileMapping',
      body: this.world.securitymapping
    };

  return this.send(msg);
};

ApiRT.prototype.getRoleMapping = function () {
  const
    msg = {
      controller: 'security',
      action: 'getRoleMapping'
    };

  return this.send(msg);
};

ApiRT.prototype.updateRoleMapping = function () {
  const
    msg = {
      controller: 'security',
      action: 'updateRoleMapping',
      body: this.world.securitymapping
    };

  return this.send(msg);
};

ApiRT.prototype.getUserMapping = function () {
  const
    msg = {
      controller: 'security',
      action: 'getUserMapping'
    };

  return this.send(msg);
};

ApiRT.prototype.updateUserMapping = function () {
  const
    msg = {
      controller: 'security',
      action: 'updateUserMapping',
      body: this.world.securitymapping
    };

  return this.send(msg);
};

ApiRT.prototype.bulkImport = function (bulk, index, collection) {
  const
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
  const
    msg = {
      controller: 'bulk',
      action: 'import',
      body: {bulkData: bulk}
    };

  return this.send(msg);
};

ApiRT.prototype.subscribe = function (filters, client) {
  const
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
  const
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
  const
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
  const
    msg = {
      controller: 'server',
      action: 'getStats',
      body: dates
    };

  return this.send(msg);
};

ApiRT.prototype.getLastStats = function () {
  const
    msg = {
      controller: 'server',
      action: 'getLastStats'
    };

  return this.send(msg);
};

ApiRT.prototype.getAllStats = function () {
  const
    msg = {
      controller: 'server',
      action: 'getAllStats'
    };

  return this.send(msg);
};

ApiRT.prototype.listCollections = function (index, type) {
  const
    msg = {
      controller: 'collection',
      index: index || this.world.fakeIndex,
      action: 'list',
      body: {type}
    };

  return this.send(msg);
};

ApiRT.prototype.now = function () {
  const
    msg = {
      controller: 'server',
      action: 'now'
    };

  return this.send(msg);
};

ApiRT.prototype.truncateCollection = function (index, collection) {
  const
    msg = {
      controller: 'collection',
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'truncate'
    };

  return this.send(msg);
};

ApiRT.prototype.listSubscriptions = function () {
  const
    msg = {
      controller: 'realtime',
      action: 'list'
    };

  return this.send(msg);
};

ApiRT.prototype.deleteIndexes = function () {
  const
    msg = {
      controller: 'index',
      action: 'mdelete'
    };

  return this.send(msg);
};

ApiRT.prototype.listIndexes = function () {
  const
    msg = {
      controller: 'index',
      action: 'list'
    };

  return this.send(msg);
};

ApiRT.prototype.createIndex = function (index) {
  const
    msg = {
      controller: 'index',
      action: 'create',
      index: index
    };

  return this.send(msg);
};

ApiRT.prototype.deleteIndex = function (index) {
  const
    msg = {
      controller: 'index',
      action: 'delete',
      index: index
    };

  return this.send(msg);
};

ApiRT.prototype.getServerInfo = function () {
  const
    msg = {
      controller: 'server',
      action: 'info',
      body: {}
    };

  return this.send(msg);
};

ApiRT.prototype.login = function (strategy, credentials) {
  const
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
  const
    msg = {
      controller: 'auth',
      action: 'logout',
      jwt: jwtToken
    };

  return this.send(msg);
};

ApiRT.prototype.createOrReplaceRole = function (id, body) {
  const
    msg = {
      controller: 'security',
      action: 'createOrReplaceRole',
      _id: id,
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.getRole = function (id) {
  const
    msg = {
      controller: 'security',
      action: 'getRole',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.mGetRoles = function (body) {
  const
    msg = {
      controller: 'security',
      action: 'mGetRoles',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.searchRoles = function (body, args) {
  const
    msg = {
      controller: 'security',
      action: 'searchRoles',
      body: body
    };

  _.forEach(args, (item, k) => {
    msg[k] = item;
  });

  return this.send(msg);
};

ApiRT.prototype.deleteRole = function (id) {
  const
    msg = {
      controller: 'security',
      action: 'deleteRole',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.createOrReplaceRole = function (id, body) {
  const
    msg = {
      controller: 'security',
      action: 'createOrReplaceRole',
      _id: id,
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.getProfile = function (id) {
  const
    msg = {
      controller: 'security',
      action: 'getProfile',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.getProfileRights = function (id) {
  const
    msg = {
      controller: 'security',
      action: 'getProfileRights',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.mGetProfiles = function (body) {
  const
    msg = {
      controller: 'security',
      action: 'mGetProfiles',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.createOrReplaceProfile = function (id, body) {
  const
    msg = {
      controller: 'security',
      action: 'createOrReplaceProfile',
      _id: id,
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.searchProfiles = function (body) {
  const
    msg = {
      controller: 'security',
      action: 'searchProfiles',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.deleteProfile = function (id) {
  const
    msg = {
      controller: 'security',
      action: 'deleteProfile',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.searchValidations = function (body) {
  const
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
  const msg = {
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
  const msg = {
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
  const msg = {
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
