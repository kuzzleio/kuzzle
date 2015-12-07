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

ApiRT.prototype.create = function (body, persist) {
  var
    msg = {
      controller: 'write',
      collection: this.world.fakeCollection,
      action: 'create',
      persist: persist,
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.createOrUpdate = function (body) {
  var
    msg = {
      controller: 'write',
      collection: this.world.fakeCollection,
      action: 'createOrUpdate',
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.get = function (id) {
  var
    msg = {
      controller: 'read',
      collection: this.world.fakeCollection,
      action: 'get',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.search = function (filters) {
  var
    msg = {
      controller: 'read',
      collection: this.world.fakeCollection,
      action: 'search',
      body: filters
    };

  return this.send(msg);
};

ApiRT.prototype.count = function (filters) {
  var
    msg = {
      controller: 'read',
      collection: this.world.fakeCollection,
      action: 'count',
      body: filters
    };

  return this.send(msg);
};

ApiRT.prototype.update = function (id, body) {
  var
    msg = {
      controller: 'write',
      collection: this.world.fakeCollection,
      action: 'update',
      _id: id,
      body: body
    };

  return this.send(msg);
};

ApiRT.prototype.deleteById = function (id) {
  var
    msg = {
      controller: 'write',
      collection: this.world.fakeCollection,
      action: 'delete',
      _id: id
    };

  return this.send(msg);
};

ApiRT.prototype.deleteByQuery = function (filters) {
  var
    msg = {
      controller: 'write',
      collection: this.world.fakeCollection,
      action: 'deleteByQuery',
      body: filters
    };

  return this.send(msg);
};

ApiRT.prototype.deleteCollection = function () {
  var
    msg = {
      controller: 'admin',
      collection: this.world.fakeCollection,
      action: 'deleteCollection'
    };

  return this.send(msg);
};

ApiRT.prototype.putMapping = function () {
  var
    msg = {
      controller: 'admin',
      collection: this.world.fakeCollection,
      action: 'putMapping',
      body: this.world.schema
    };

  return this.send(msg);
};

ApiRT.prototype.bulkImport = function (bulk) {
  var
    msg = {
      controller: 'bulk',
      collection: this.world.fakeCollection,
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
      action: 'on',
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

ApiRT.prototype.listCollections = function () {
  var
    msg = {
      controller: 'read',
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

ApiRT.prototype.truncateCollection = function () {
  var
    msg = {
      controller: 'admin',
      collection: this.world.fakeCollection,
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

ApiRT.prototype.removeRooms = function (rooms) {
  var
    msg = {
      controller: 'admin',
      action: 'removeRooms',
      collection: this.world.fakeCollection,
      body: {rooms: rooms}
    };

  return this.send(msg);
};

module.exports = ApiRT;