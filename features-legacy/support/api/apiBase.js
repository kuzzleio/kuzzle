"use strict";

/**
 * This file contains the main API method for real-time protocols.
 * Avoid to add a new function in each api protocols when a new action in Kuzzle is added.
 *
 * NOTE: must be added in api HTTP because the apiHttp file doesn't extend this ApiRT
 */

const _ = require("lodash"),
  Bluebird = require("bluebird");

class ApiBase {
  constructor(world) {
    this.world = world;

    this.clientId = null;
    this.subscribedRooms = {};
    this.responses = null;

    this.isRealTimeCapable = true;
  }

  send() {
    throw new Error("not implemented");
  }

  sendAndListen() {
    throw new Error("not implemented");
  }

  adminResetDatabase() {
    const msg = {
      controller: "admin",
      action: "resetDatabase",
    };

    return this.send(msg);
  }

  serverPublicApi() {
    const msg = {
      controller: "server",
      action: "publicApi",
    };

    return this.send(msg);
  }

  bulkImport(bulk, index, collection) {
    const msg = {
      controller: "bulk",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "import",
      body: { bulkData: bulk },
    };

    return this.send(msg);
  }

  bulkMWrite(index, collection, body) {
    const msg = {
      controller: "bulk",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "mWrite",
      body,
    };

    return this.send(msg);
  }

  bulkWrite(index, collection, body, _id = null) {
    const msg = {
      controller: "bulk",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "write",
      _id,
      body,
    };

    return this.send(msg);
  }

  collectionExists(index, collection) {
    return this.send({
      index,
      collection,
      controller: "collection",
      action: "exists",
    });
  }

  callMemoryStorage(command, args) {
    const msg = {
      controller: "ms",
      action: command,
    };
    _.forEach(args, (value, prop) => {
      if (prop === "args") {
        _.forEach(value, (item, k) => {
          msg[k] = item;
        });
      } else {
        msg[prop] = value;
      }
    });

    return this.send(msg);
  }

  checkToken(token) {
    let _token = null;

    if (this.world.currentUser && this.world.currentUser.token) {
      _token = this.world.currentUser.token;
      this.world.currentUser.token = null;
    }

    return this.send({
      controller: "auth",
      action: "checkToken",
      body: { token },
    })
      .then((response) => {
        if (_token !== null) {
          this.world.currentUser.token = _token;
        }

        return response;
      })
      .catch((error) => {
        if (_token !== null) {
          this.world.currentUser.token = _token;
        }

        return Bluebird.reject(error);
      });
  }

  count(query, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "count",
      body: query,
    };

    return this.send(msg);
  }

  countSubscription() {
    const clients = Object.keys(this.subscribedRooms),
      rooms = Object.keys(this.subscribedRooms[clients[0]]),
      msg = {
        controller: "realtime",
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
        action: "count",
        body: {
          roomId: rooms[0],
        },
      };

    return this.send(msg);
  }

  create(body, index, collection, jwtToken, id) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "create",
      body,
      refresh: "wait_for",
    };

    if (id) {
      msg._id = id;
    }

    if (jwtToken !== undefined) {
      msg.headers = {
        authorization: "Bearer " + jwtToken,
      };
    }

    return this.send(msg);
  }

  createIndex(index) {
    const msg = {
      controller: "index",
      action: "create",
      index: index,
    };

    return this.send(msg);
  }

  createCollection(index, collection, mappings) {
    const msg = {
      controller: "collection",
      action: "create",
      index: index || this.world.fakeIndex,
      collection,
      body: mappings,
    };

    return this.send(msg);
  }

  getCollectionMapping(index, collection, includeKuzzleMeta = false) {
    const msg = {
      includeKuzzleMeta,
      controller: "collection",
      action: "getMapping",
      index,
      collection,
    };

    return this.send(msg);
  }

  createCredentials(strategy, userId, body) {
    return this.send({
      controller: "security",
      action: "createCredentials",
      strategy,
      body,
      _id: userId,
    });
  }

  createMyCredentials(strategy, body) {
    return this.send({
      controller: "auth",
      action: "createMyCredentials",
      strategy,
      body,
    });
  }

  createOrReplace(body, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "createOrReplace",
      body: body,
    };

    if (body._id) {
      msg._id = body._id;
      delete body._id;
    }

    return this.send(msg);
  }

  createOrReplaceProfile(id, body) {
    const msg = {
      controller: "security",
      action: "createOrReplaceProfile",
      _id: id,
      body: body,
    };

    return this.send(msg);
  }

  createOrReplaceRole(id, body) {
    const msg = {
      controller: "security",
      action: "createOrReplaceRole",
      _id: id,
      body: body,
    };

    return this.send(msg);
  }

  createRestrictedUser(body, id) {
    const msg = {
      controller: "security",
      action: "createRestrictedUser",
      body: body,
    };
    if (id !== undefined) {
      msg._id = id;
    }

    return this.send(msg);
  }

  createUser(body, id) {
    const msg = {
      controller: "security",
      action: "createUser",
      refresh: "wait_for",
      body,
    };

    if (id !== undefined) {
      msg._id = id;
    }

    return this.send(msg);
  }

  createFirstAdmin(body, id, reset) {
    const msg = {
      controller: "security",
      action: "createFirstAdmin",
      body: body,
    };

    if (id !== undefined) {
      msg._id = id;
    }

    if (reset) {
      msg.reset = true;
    }

    return this.send(msg);
  }

  credentialsExist(strategy, body) {
    return this.send({
      controller: "auth",
      action: "credentialsExist",
      strategy,
      body,
    });
  }

  deleteById(id, index) {
    const msg = {
      controller: "document",
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "delete",
      _id: id,
    };

    return this.send(msg);
  }

  deleteByQuery(query, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "deleteByQuery",
      body: query,
    };

    return this.send(msg);
  }

  deleteCredentials(strategy, userId) {
    return this.send({
      controller: "security",
      action: "deleteCredentials",
      strategy,
      _id: userId,
    });
  }

  deleteIndex(index) {
    const msg = {
      controller: "index",
      action: "delete",
      index: index,
    };

    return this.send(msg);
  }

  deleteIndexes() {
    const msg = {
      controller: "index",
      action: "mdelete",
    };

    return this.send(msg);
  }

  deleteMyCredentials(strategy) {
    return this.send({
      controller: "auth",
      action: "deleteMyCredentials",
      strategy,
    });
  }

  deleteProfile(id, waitFor = false) {
    const msg = {
      controller: "security",
      action: "deleteProfile",
      _id: id,
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  deleteProfiles(ids, waitFor = false) {
    const msg = {
      controller: "security",
      action: "mDeleteProfiles",
      body: {
        ids,
      },
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  deleteRole(id, waitFor = false) {
    const msg = {
      controller: "security",
      action: "deleteRole",
      _id: id,
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  deleteRoles(ids, waitFor = false) {
    const msg = {
      controller: "security",
      action: "mDeleteRoles",
      body: {
        ids,
      },
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  deleteSpecifications(index, collection) {
    return this.send({
      index: index,
      collection: collection,
      controller: "collection",
      action: "deleteSpecifications",
      body: null,
    });
  }

  deleteUser(id, waitFor = false) {
    const msg = {
      controller: "security",
      action: "deleteUser",
      _id: id,
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  deleteUsers(ids, waitFor = false) {
    const msg = {
      controller: "security",
      action: "mDeleteUsers",
      body: {
        ids,
      },
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  exists(id, index) {
    const msg = {
      controller: "document",
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "exists",
      _id: id,
    };

    return this.send(msg);
  }

  get(id, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "get",
      _id: id,
    };

    return this.send(msg);
  }

  getAllStats() {
    const msg = {
      controller: "server",
      action: "getAllStats",
    };

    return this.send(msg);
  }

  getAuthenticationStrategies() {
    return this.send({
      controller: "auth",
      action: "getStrategies",
      body: {},
    });
  }

  getCredentials(strategy, userId) {
    return this.send({
      controller: "security",
      action: "getCredentials",
      strategy,
      _id: userId,
    });
  }

  getCredentialsById(strategy, userId) {
    return this.send({
      controller: "security",
      action: "getCredentialsById",
      strategy,
      _id: userId,
    });
  }

  getCurrentUser() {
    return this.send({
      controller: "auth",
      action: "getCurrentUser",
    });
  }

  getLastStats() {
    const msg = {
      controller: "server",
      action: "getLastStats",
    };

    return this.send(msg);
  }

  getMyCredentials(strategy) {
    return this.send({
      controller: "auth",
      action: "getMyCredentials",
      strategy,
    });
  }

  getMyRights(id) {
    return this.send({
      controller: "auth",
      action: "getMyRights",
      _id: id,
    });
  }

  getProfile(id) {
    const msg = {
      controller: "security",
      action: "getProfile",
      _id: id,
    };

    return this.send(msg);
  }

  getProfileMapping() {
    const msg = {
      controller: "security",
      action: "getProfileMapping",
    };

    return this.send(msg);
  }

  getProfileRights(id) {
    const msg = {
      controller: "security",
      action: "getProfileRights",
      _id: id,
    };

    return this.send(msg);
  }

  getRole(id) {
    const msg = {
      controller: "security",
      action: "getRole",
      _id: id,
    };

    return this.send(msg);
  }

  getRoleMapping() {
    const msg = {
      controller: "security",
      action: "getRoleMapping",
    };

    return this.send(msg);
  }

  getSpecifications(index, collection) {
    return this.send({
      index: index,
      collection: collection,
      controller: "collection",
      action: "getSpecifications",
    });
  }

  getStats(dates) {
    const msg = {
      controller: "server",
      action: "getStats",
      body: dates,
    };

    return this.send(msg);
  }

  getUser(id) {
    return this.send({
      controller: "security",
      action: "getUser",
      _id: id,
    });
  }

  getUserMapping() {
    const msg = {
      controller: "security",
      action: "getUserMapping",
    };

    return this.send(msg);
  }

  getUserRights(id) {
    return this.send({
      controller: "security",
      action: "getUserRights",
      _id: id,
    });
  }

  hasCredentials(strategy, userId) {
    return this.send({
      controller: "security",
      action: "hasCredentials",
      strategy,
      _id: userId,
    });
  }

  indexExists(index) {
    return this.send({
      index,
      controller: "index",
      action: "exists",
    });
  }

  refreshCollection(index, collection) {
    const msg = {
      controller: "collection",
      action: "refresh",
      index: index || this.world.fakeIndex,
      collection: collection || this.world.fakeCollection,
    };

    return this.send(msg);
  }

  listCollections(index, type) {
    const msg = {
      controller: "collection",
      index: index || this.world.fakeIndex,
      action: "list",
      body: { type },
    };

    return this.send(msg);
  }

  listIndexes() {
    const msg = {
      controller: "index",
      action: "list",
    };

    return this.send(msg);
  }

  listSubscriptions() {
    const msg = {
      controller: "realtime",
      action: "list",
    };

    return this.send(msg);
  }

  login(strategy, credentials) {
    const msg = {
      controller: "auth",
      action: "login",
      strategy: strategy,
      expiresIn: credentials.expiresIn,
      body: {
        username: credentials.username,
        password: credentials.password,
      },
    };

    return this.send(msg);
  }

  logout(jwtToken, global = false) {
    const msg = {
      controller: "auth",
      action: "logout",
      jwt: jwtToken,
    };

    if (global) {
      msg.global = true;
    }
    return this.send(msg);
  }

  mCreate(body, index, collection, jwtToken) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "mCreate",
      body,
    };

    if (jwtToken !== undefined) {
      msg.headers = {
        authorization: "Bearer " + jwtToken,
      };
    }

    return this.send(msg);
  }

  mCreateOrReplace(body, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "mCreateOrReplace",
      body: body,
    };

    return this.send(msg);
  }

  mDelete(body, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "mDelete",
      body,
    };

    return this.send(msg);
  }

  mGet(body, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "mGet",
      body,
    };

    return this.send(msg);
  }

  mGetProfiles(body) {
    const msg = {
      controller: "security",
      action: "mGetProfiles",
      body: body,
    };

    return this.send(msg);
  }

  mGetRoles(body) {
    const msg = {
      controller: "security",
      action: "mGetRoles",
      body: body,
    };

    return this.send(msg);
  }

  mReplace(body, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "mReplace",
      body: body,
    };

    return this.send(msg);
  }

  mUpdate(body, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "mUpdate",
      body: body,
    };

    return this.send(msg);
  }

  now() {
    const msg = {
      controller: "server",
      action: "now",
    };

    return this.send(msg);
  }

  postDocument(index, collection, document) {
    return this.send({
      index,
      collection,
      controller: "document",
      action: "create",
      body: document,
    });
  }

  publish(body, index) {
    const msg = {
      controller: "realtime",
      collection: this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "publish",
      body: body,
    };

    return this.send(msg);
  }

  refreshToken() {
    return this.send({
      controller: "auth",
      action: "refreshToken",
    });
  }

  replace(body, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "replace",
      body: body,
    };

    if (body._id) {
      msg._id = body._id;
      delete body._id;
    }

    return this.send(msg);
  }

  replaceUser(id, body) {
    return this.send({
      controller: "security",
      action: "replaceUser",
      _id: id,
      body,
    });
  }

  revokeTokens(id) {
    return this.send({
      controller: "security",
      action: "revokeTokens",
      _id: id,
    });
  }

  scroll(scrollId, scroll) {
    const msg = {
      controller: "document",
      action: "scroll",
      scrollId,
      scroll,
    };

    return this.send(msg);
  }

  scrollProfiles(scrollId) {
    return this.send({
      controller: "security",
      action: "scrollProfiles",
      scrollId,
    });
  }

  scrollSpecifications(scrollId) {
    return this.send({
      controller: "collection",
      action: "scrollSpecifications",
      scrollId,
    });
  }

  scrollUsers(scrollId) {
    return this.send({
      controller: "security",
      action: "scrollUsers",
      scrollId,
    });
  }

  search(query, index, collection, args) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "search",
      body: query,
    };

    _.forEach(args, (item, k) => {
      msg[k] = item;
    });

    return this.send(msg);
  }

  searchProfiles(roles, args) {
    const msg = {
      controller: "security",
      action: "searchProfiles",
      body: {
        roles,
      },
    };

    _.forEach(args, (item, k) => {
      msg[k] = item;
    });

    return this.send(msg);
  }

  searchRoles(body, args) {
    const msg = {
      controller: "security",
      action: "searchRoles",
      body,
    };

    _.forEach(args, (item, k) => {
      msg[k] = item;
    });

    return this.send(msg);
  }

  searchSpecifications(body, args) {
    let msg = {
      controller: "collection",
      action: "searchSpecifications",
      body: body,
    };

    if (args) {
      Object.assign(msg, args);
    }

    return this.send(msg);
  }

  searchUsers(query, args) {
    const msg = {
      controller: "security",
      action: "searchUsers",
      body: {
        query,
      },
    };

    if (args) {
      Object.assign(msg, args);
    }

    return this.send(msg);
  }

  subscribe(filters, client, authentified = false) {
    const msg = {
      controller: "realtime",
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      action: "subscribe",
      users: "all",
      body: null,
    };

    if (authentified) {
      msg.jwt = this.world.currentUser.token;
    }

    if (filters) {
      msg.body = filters;
    }

    return this.sendAndListen(msg, client);
  }

  truncateCollection(index, collection) {
    const msg = {
      controller: "collection",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "truncate",
    };

    return this.send(msg);
  }

  unsubscribe(room, clientId) {
    const msg = {
      clientId: clientId,
      controller: "realtime",
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      action: "unsubscribe",
      body: { roomId: room },
    };

    this.subscribedRooms[clientId][room].close();
    delete this.subscribedRooms[clientId];
    this.responses = null;
    return this.send(msg, false);
  }

  update(id, body, index, collection) {
    const msg = {
      controller: "document",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "update",
      _id: id,
      body: body,
    };

    return this.send(msg);
  }

  updateCredentials(strategy, userId, body) {
    return this.send({
      controller: "security",
      action: "updateCredentials",
      strategy,
      body,
      _id: userId,
    });
  }

  updateMapping(index, collection, mapping) {
    const msg = {
      controller: "collection",
      collection: collection || this.world.fakeCollection,
      index: index || this.world.fakeIndex,
      action: "updateMapping",
      body: mapping || this.world.mapping,
    };

    return this.send(msg);
  }

  updateMyCredentials(strategy, body) {
    return this.send({
      controller: "auth",
      action: "updateMyCredentials",
      strategy,
      body,
    });
  }

  updateProfileMapping() {
    const msg = {
      controller: "security",
      action: "updateProfileMapping",
      body: this.world.securitymapping,
    };

    return this.send(msg);
  }

  updateRoleMapping() {
    const msg = {
      controller: "security",
      action: "updateRoleMapping",
      body: this.world.securitymapping,
    };

    return this.send(msg);
  }

  updateSelf(body) {
    return this.send({
      controller: "auth",
      action: "updateSelf",
      body: body,
    });
  }

  updateSpecifications(index, collection, specifications) {
    return this.send({
      index,
      collection,
      controller: "collection",
      action: "updateSpecifications",
      body: specifications,
    });
  }

  updateUserMapping() {
    const msg = {
      controller: "security",
      action: "updateUserMapping",
      body: this.world.securitymapping,
    };

    return this.send(msg);
  }

  validateCredentials(strategy, userId, body) {
    return this.send({
      controller: "security",
      action: "validateCredentials",
      strategy,
      body,
      _id: userId,
    });
  }

  validateDocument(index, collection, document) {
    return this.create(document, index, collection);
  }

  validateMyCredentials(strategy, body) {
    return this.send({
      controller: "auth",
      action: "validateMyCredentials",
      strategy,
      body,
    });
  }

  validateSpecifications(index, collection, specifications) {
    return this.send({
      index,
      collection,
      controller: "collection",
      action: "validateSpecifications",
      body: specifications,
    });
  }

  resetCache(database) {
    return this.send({
      controller: "admin",
      action: "resetCache",
      database,
    });
  }

  resetKuzzleData() {
    return this.send({
      controller: "admin",
      action: "resetKuzzleData",
    });
  }

  resetSecurity() {
    return this.send({
      controller: "admin",
      action: "resetSecurity",
      refresh: "wait_for",
    });
  }

  resetDatabase() {
    return this.send({
      controller: "admin",
      action: "resetDatabase",
    });
  }

  loadMappings(body) {
    return this.send({
      body,
      controller: "admin",
      action: "loadMappings",
      refresh: "wait_for",
    });
  }

  loadFixtures(body) {
    return this.send({
      body,
      controller: "admin",
      action: "loadFixtures",
      refresh: "wait_for",
    });
  }

  loadSecurities(body) {
    return this.send({
      body,
      controller: "admin",
      action: "loadSecurities",
      refresh: "wait_for",
    });
  }
}

module.exports = ApiBase;
