/**
 * This file contains the main API method for real-time protocols.
 * Avoid to add a new function in each api protocols when a new action in Kuzzle is added.
 *
 * NOTE: must be added in api REST because the apiREST file doesn't extend this ApiRT
 */

var ApiRT = function () {
  this.world = null;
  this.clientId = null;
  this.subscribedRooms = {};
  this.responses = null;
};

ApiRT.prototype.send = function () {};
ApiRT.prototype.sendAndListen = function () {};

ApiRT.prototype.create = function (body, index) {
  var
    msg = {
      controller: 'write',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'create',
      body: body
    };

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

ApiRT.prototype.createOrUpdate = function (body, index) {
  var
    msg = {
      controller: 'write',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'createOrUpdate',
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

ApiRT.prototype.search = function (filters, index) {
  var
    msg = {
      controller: 'read',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'search',
      body: filters
    };

  return this.send(msg);
};

ApiRT.prototype.count = function (filters, index) {
  var
    msg = {
      controller: 'read',
      collection: this.world.fakeCollection,
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

ApiRT.prototype.deleteByQuery = function (filters, index) {
  var
    msg = {
      controller: 'write',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'deleteByQuery',
      body: filters
    };

  return this.send(msg);
};

ApiRT.prototype.deleteCollection = function (index) {
  var
    msg = {
      controller: 'admin',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'deleteCollection'
    };

  return this.send(msg);
};

ApiRT.prototype.putMapping = function (index) {
  var
    msg = {
      controller: 'admin',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'putMapping',
      body: this.world.schema
    };

  return this.send(msg);
};

ApiRT.prototype.bulkImport = function (bulk, index) {
  var
    msg = {
      controller: 'bulk',
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: 'import',
      body: bulk
    };

  return this.send(msg);
};

ApiRT.prototype.globalBulkImport = function (bulk) {
  var
    msg = {
      controller: 'bulk',
      action: 'import',
      body: bulk
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

ApiRT.prototype.listCollections = function (index) {
  var
    msg = {
      controller: 'read',
      index: index || this.world.fakeIndex,
      action: 'listCollections'
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

ApiRT.prototype.truncateCollection = function (index) {
  var
    msg = {
      controller: 'admin',
      collection: this.world.fakeCollection,
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

module.exports = ApiRT;