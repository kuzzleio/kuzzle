/**
 * This file contains the main API method for real-time protocols.
 * Avoid to add a new function in each api protocols when a new action in Kuzzle is added.
 *
 * NOTE: must be added in api HTTP because the apiHttp file doesn't extend this ApiRT
 */

import Bluebird from "bluebird";

type ApiMessage = Record<string, any>;

export default abstract class ApiBase {
  protected world: any;
  protected clientId: string | null;
  protected subscribedRooms: Record<string, any>;
  protected responses: any;
  protected isRealTimeCapable: boolean;

  constructor(world: any) {
    this.world = world;

    this.clientId = null;
    this.subscribedRooms = {};
    this.responses = null;

    this.isRealTimeCapable = true;
  }

  abstract send(msg: ApiMessage, getAnswer?: boolean, socketName?: string);

  abstract sendAndListen(msg: ApiMessage, socketName?: string);

  adminResetDatabase() {
    const msg = {
      action: "resetDatabase",
      controller: "admin",
    };

    return this.send(msg);
  }

  serverPublicApi() {
    const msg = {
      action: "publicApi",
      controller: "server",
    };

    return this.send(msg);
  }

  bulkImport(bulk, index, collection) {
    const msg = {
      action: "import",
      body: { bulkData: bulk },
      collection: collection || this.world.fakeCollection,
      controller: "bulk",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  bulkMWrite(index, collection, body) {
    const msg = {
      action: "mWrite",
      body,
      collection: collection || this.world.fakeCollection,
      controller: "bulk",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  bulkWrite(index, collection, body, _id = null) {
    const msg = {
      _id,
      action: "write",
      body,
      collection: collection || this.world.fakeCollection,
      controller: "bulk",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  collectionExists(index, collection) {
    return this.send({
      action: "exists",
      collection,
      controller: "collection",
      index,
    });
  }

  callMemoryStorage(command, args) {
    const msg = {
      action: command,
      controller: "ms",
    };

    for (const [prop, value] of Object.entries(args)) {
      if (prop === "args") {
        for (const [k, item] of Object.entries(value)) {
          msg[k] = item;
        }
      } else {
        msg[prop] = value;
      }
    }

    return this.send(msg);
  }

  checkToken(token) {
    let _token = null;

    if (this.world.currentUser && this.world.currentUser.token) {
      _token = this.world.currentUser.token;
      this.world.currentUser.token = null;
    }

    return this.send({
      action: "checkToken",
      body: { token },
      controller: "auth",
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
      action: "count",
      body: query,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  countSubscription() {
    const clients = Object.keys(this.subscribedRooms),
      rooms = Object.keys(this.subscribedRooms[clients[0]]),
      msg = {
        action: "count",
        body: {
          roomId: rooms[0],
        },
        collection: this.world.fakeCollection,
        controller: "realtime",
        index: this.world.fakeIndex,
      };

    return this.send(msg);
  }

  create(body: any, index?: any, collection?: any, jwtToken?: any, id?: any) {
    const msg: ApiMessage = {
      action: "create",
      body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
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
      action: "create",
      controller: "index",
      index: index,
    };

    return this.send(msg);
  }

  createCollection(index, collection, mappings) {
    const msg = {
      action: "create",
      body: mappings,
      collection,
      controller: "collection",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  getCollectionMapping(index, collection, includeKuzzleMeta = false) {
    const msg = {
      action: "getMapping",
      collection,
      controller: "collection",
      includeKuzzleMeta,
      index,
    };

    return this.send(msg);
  }

  createCredentials(strategy, userId, body) {
    return this.send({
      _id: userId,
      action: "createCredentials",
      body,
      controller: "security",
      strategy,
    });
  }

  createMyCredentials(strategy, body) {
    return this.send({
      action: "createMyCredentials",
      body,
      controller: "auth",
      strategy,
    });
  }

  createOrReplace(body, index, collection) {
    const msg: any = {
      action: "createOrReplace",
      body: body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    if (body._id) {
      msg._id = body._id;
      delete body._id;
    }

    return this.send(msg);
  }

  createOrReplaceProfile(id, body) {
    const msg = {
      _id: id,
      action: "createOrReplaceProfile",
      body: body,
      controller: "security",
    };

    return this.send(msg);
  }

  createOrReplaceRole(id, body) {
    const msg = {
      _id: id,
      action: "createOrReplaceRole",
      body: body,
      controller: "security",
    };

    return this.send(msg);
  }

  createRestrictedUser(body, id) {
    const msg: any = {
      action: "createRestrictedUser",
      body: body,
      controller: "security",
    };
    if (id !== undefined) {
      msg._id = id;
    }

    return this.send(msg);
  }

  createUser(body, id) {
    const msg: any = {
      action: "createUser",
      body,
      controller: "security",
      refresh: "wait_for",
    };

    if (id !== undefined) {
      msg._id = id;
    }

    return this.send(msg);
  }

  createFirstAdmin(body, id, reset) {
    const msg: any = {
      action: "createFirstAdmin",
      body: body,
      controller: "security",
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
      action: "credentialsExist",
      body,
      controller: "auth",
      strategy,
    });
  }

  deleteById(id, index) {
    const msg = {
      _id: id,
      action: "delete",
      collection: this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  deleteByQuery(query, index, collection) {
    const msg = {
      action: "deleteByQuery",
      body: query,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  deleteCredentials(strategy, userId) {
    return this.send({
      _id: userId,
      action: "deleteCredentials",
      controller: "security",
      strategy,
    });
  }

  deleteIndex(index) {
    const msg = {
      action: "delete",
      controller: "index",
      index: index,
    };

    return this.send(msg);
  }

  deleteIndexes() {
    const msg = {
      action: "mdelete",
      controller: "index",
    };

    return this.send(msg);
  }

  deleteMyCredentials(strategy) {
    return this.send({
      action: "deleteMyCredentials",
      controller: "auth",
      strategy,
    });
  }

  deleteProfile(id, waitFor = false) {
    const msg: any = {
      _id: id,
      action: "deleteProfile",
      controller: "security",
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  deleteProfiles(ids, waitFor = false) {
    const msg: any = {
      action: "mDeleteProfiles",
      body: {
        ids,
      },
      controller: "security",
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  deleteRole(id, waitFor = false) {
    const msg: any = {
      _id: id,
      action: "deleteRole",
      controller: "security",
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  deleteRoles(ids, waitFor = false) {
    const msg: any = {
      action: "mDeleteRoles",
      body: {
        ids,
      },
      controller: "security",
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  deleteSpecifications(index, collection) {
    return this.send({
      action: "deleteSpecifications",
      body: null,
      collection: collection,
      controller: "collection",
      index: index,
    });
  }

  deleteUser(id, waitFor = false) {
    const msg: any = {
      _id: id,
      action: "deleteUser",
      controller: "security",
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  deleteUsers(ids, waitFor = false) {
    const msg: any = {
      action: "mDeleteUsers",
      body: {
        ids,
      },
      controller: "security",
    };

    if (waitFor) {
      msg.refresh = "wait_for";
    }

    return this.send(msg);
  }

  exists(id, index) {
    const msg = {
      _id: id,
      action: "exists",
      collection: this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  get(id, index, collection) {
    const msg = {
      _id: id,
      action: "get",
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  getAllStats() {
    const msg = {
      action: "getAllStats",
      controller: "server",
    };

    return this.send(msg);
  }

  getAuthenticationStrategies() {
    return this.send({
      action: "getStrategies",
      body: {},
      controller: "auth",
    });
  }

  getCredentials(strategy, userId) {
    return this.send({
      _id: userId,
      action: "getCredentials",
      controller: "security",
      strategy,
    });
  }

  getCredentialsById(strategy, userId) {
    return this.send({
      _id: userId,
      action: "getCredentialsById",
      controller: "security",
      strategy,
    });
  }

  getCurrentUser() {
    return this.send({
      action: "getCurrentUser",
      controller: "auth",
    });
  }

  getLastStats() {
    const msg = {
      action: "getLastStats",
      controller: "server",
    };

    return this.send(msg);
  }

  getMyCredentials(strategy) {
    return this.send({
      action: "getMyCredentials",
      controller: "auth",
      strategy,
    });
  }

  getMyRights(id) {
    return this.send({
      _id: id,
      action: "getMyRights",
      controller: "auth",
    });
  }

  getProfile(id) {
    const msg = {
      _id: id,
      action: "getProfile",
      controller: "security",
    };

    return this.send(msg);
  }

  getProfileMapping() {
    const msg = {
      action: "getProfileMapping",
      controller: "security",
    };

    return this.send(msg);
  }

  getProfileRights(id) {
    const msg = {
      _id: id,
      action: "getProfileRights",
      controller: "security",
    };

    return this.send(msg);
  }

  getRole(id) {
    const msg = {
      _id: id,
      action: "getRole",
      controller: "security",
    };

    return this.send(msg);
  }

  getRoleMapping() {
    const msg = {
      action: "getRoleMapping",
      controller: "security",
    };

    return this.send(msg);
  }

  getSpecifications(index, collection) {
    return this.send({
      action: "getSpecifications",
      collection: collection,
      controller: "collection",
      index: index,
    });
  }

  getStats(dates) {
    const msg = {
      action: "getStats",
      body: dates,
      controller: "server",
    };

    return this.send(msg);
  }

  getUser(id) {
    return this.send({
      _id: id,
      action: "getUser",
      controller: "security",
    });
  }

  getUserMapping() {
    const msg = {
      action: "getUserMapping",
      controller: "security",
    };

    return this.send(msg);
  }

  getUserRights(id) {
    return this.send({
      _id: id,
      action: "getUserRights",
      controller: "security",
    });
  }

  hasCredentials(strategy, userId) {
    return this.send({
      _id: userId,
      action: "hasCredentials",
      controller: "security",
      strategy,
    });
  }

  indexExists(index) {
    return this.send({
      action: "exists",
      controller: "index",
      index,
    });
  }

  refreshCollection(index, collection) {
    const msg = {
      action: "refresh",
      collection: collection || this.world.fakeCollection,
      controller: "collection",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  listCollections(index, type) {
    const msg = {
      action: "list",
      body: { type },
      controller: "collection",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  listIndexes() {
    const msg = {
      action: "list",
      controller: "index",
    };

    return this.send(msg);
  }

  listSubscriptions() {
    const msg = {
      action: "list",
      controller: "realtime",
    };

    return this.send(msg);
  }

  login(strategy, credentials) {
    const msg = {
      action: "login",
      body: {
        password: credentials.password,
        username: credentials.username,
      },
      controller: "auth",
      expiresIn: credentials.expiresIn,
      strategy: strategy,
    };

    return this.send(msg);
  }

  logout(jwtToken, global = false) {
    const msg: ApiMessage = {
      action: "logout",
      controller: "auth",
      jwt: jwtToken,
    };

    if (global) {
      msg.global = true;
    }
    return this.send(msg);
  }

  mCreate(body, index, collection, jwtToken) {
    const msg: ApiMessage = {
      action: "mCreate",
      body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
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
      action: "mCreateOrReplace",
      body: body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  mDelete(body, index, collection) {
    const msg = {
      action: "mDelete",
      body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  mGet(body, index, collection) {
    const msg = {
      action: "mGet",
      body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  mGetProfiles(body) {
    const msg = {
      action: "mGetProfiles",
      body: body,
      controller: "security",
    };

    return this.send(msg);
  }

  mGetRoles(body) {
    const msg = {
      action: "mGetRoles",
      body: body,
      controller: "security",
    };

    return this.send(msg);
  }

  mReplace(body, index, collection) {
    const msg = {
      action: "mReplace",
      body: body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  mUpdate(body, index, collection) {
    const msg = {
      action: "mUpdate",
      body: body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  now() {
    const msg = {
      action: "now",
      controller: "server",
    };

    return this.send(msg);
  }

  postDocument(index, collection, document) {
    return this.send({
      action: "create",
      body: document,
      collection,
      controller: "document",
      index,
    });
  }

  publish(body, index) {
    const msg = {
      action: "publish",
      body: body,
      collection: this.world.fakeCollection,
      controller: "realtime",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  refreshToken() {
    return this.send({
      action: "refreshToken",
      controller: "auth",
    });
  }

  replace(body, index, collection) {
    const msg: ApiMessage = {
      action: "replace",
      body: body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    if (body._id) {
      msg._id = body._id;
      delete body._id;
    }

    return this.send(msg);
  }

  replaceUser(id, body) {
    return this.send({
      _id: id,
      action: "replaceUser",
      body,
      controller: "security",
    });
  }

  revokeTokens(id) {
    return this.send({
      _id: id,
      action: "revokeTokens",
      controller: "security",
    });
  }

  scroll(scrollId, scroll) {
    const msg = {
      action: "scroll",
      controller: "document",
      scroll,
      scrollId,
    };

    return this.send(msg);
  }

  scrollProfiles(scrollId) {
    return this.send({
      action: "scrollProfiles",
      controller: "security",
      scrollId,
    });
  }

  scrollSpecifications(scrollId) {
    return this.send({
      action: "scrollSpecifications",
      controller: "collection",
      scrollId,
    });
  }

  scrollUsers(scrollId) {
    return this.send({
      action: "scrollUsers",
      controller: "security",
      scrollId,
    });
  }

  search(query, index, collection, args) {
    const msg = {
      action: "search",
      body: query,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    if (args) {
      for (const [k, item] of Object.entries(args)) {
        msg[k] = item;
      }
    }

    return this.send(msg);
  }

  searchProfiles(roles, args) {
    const msg = {
      action: "searchProfiles",
      body: {
        roles,
      },
      controller: "security",
    };

    if (args) {
      for (const [k, item] of Object.entries(args)) {
        msg[k] = item;
      }
    }

    return this.send(msg);
  }

  searchRoles(body, args) {
    const msg = {
      action: "searchRoles",
      body,
      controller: "security",
    };

    if (args) {
      for (const [k, item] of Object.entries(args)) {
        msg[k] = item;
      }
    }

    return this.send(msg);
  }

  searchSpecifications(body, args) {
    const msg: ApiMessage = {
      action: "searchSpecifications",
      body: body,
      controller: "collection",
    };

    if (args) {
      Object.assign(msg, args);
    }

    return this.send(msg);
  }

  searchUsers(query, args) {
    const msg = {
      action: "searchUsers",
      body: {
        query,
      },
      controller: "security",
    };

    if (args) {
      Object.assign(msg, args);
    }

    return this.send(msg);
  }

  subscribe(filters, client, authentified = false) {
    const msg: ApiMessage = {
      action: "subscribe",
      body: null,
      collection: this.world.fakeCollection,
      controller: "realtime",
      index: this.world.fakeIndex,
      users: "all",
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
      action: "truncate",
      collection: collection || this.world.fakeCollection,
      controller: "collection",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  unsubscribe(room, clientId) {
    const msg = {
      action: "unsubscribe",
      body: { roomId: room },
      clientId: clientId,
      collection: this.world.fakeCollection,
      controller: "realtime",
      index: this.world.fakeIndex,
    };

    this.subscribedRooms[clientId][room].close();
    delete this.subscribedRooms[clientId];
    this.responses = null;
    return this.send(msg, false);
  }

  update(id, body, index, collection) {
    const msg = {
      _id: id,
      action: "update",
      body: body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  updateCredentials(strategy, userId, body) {
    return this.send({
      _id: userId,
      action: "updateCredentials",
      body,
      controller: "security",
      strategy,
    });
  }

  updateMapping(index, collection, mapping) {
    const msg = {
      action: "updateMapping",
      body: mapping || this.world.mapping,
      collection: collection || this.world.fakeCollection,
      controller: "collection",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  updateMyCredentials(strategy, body) {
    return this.send({
      action: "updateMyCredentials",
      body,
      controller: "auth",
      strategy,
    });
  }

  updateProfileMapping() {
    const msg = {
      action: "updateProfileMapping",
      body: this.world.securitymapping,
      controller: "security",
    };

    return this.send(msg);
  }

  updateRoleMapping() {
    const msg = {
      action: "updateRoleMapping",
      body: this.world.securitymapping,
      controller: "security",
    };

    return this.send(msg);
  }

  updateSelf(body) {
    return this.send({
      action: "updateSelf",
      body: body,
      controller: "auth",
    });
  }

  updateSpecifications(index, collection, specifications) {
    return this.send({
      action: "updateSpecifications",
      body: specifications,
      collection,
      controller: "collection",
      index,
    });
  }

  updateUserMapping() {
    const msg = {
      action: "updateUserMapping",
      body: this.world.securitymapping,
      controller: "security",
    };

    return this.send(msg);
  }

  validateCredentials(strategy, userId, body) {
    return this.send({
      _id: userId,
      action: "validateCredentials",
      body,
      controller: "security",
      strategy,
    });
  }

  validateDocument(index, collection, document) {
    return this.create(document, index, collection);
  }

  validateMyCredentials(strategy, body) {
    return this.send({
      action: "validateMyCredentials",
      body,
      controller: "auth",
      strategy,
    });
  }

  validateSpecifications(index, collection, specifications) {
    return this.send({
      action: "validateSpecifications",
      body: specifications,
      collection,
      controller: "collection",
      index,
    });
  }

  resetCache(database) {
    return this.send({
      action: "resetCache",
      controller: "admin",
      database,
    });
  }

  resetKuzzleData() {
    return this.send({
      action: "resetKuzzleData",
      controller: "admin",
    });
  }

  resetSecurity() {
    return this.send({
      action: "resetSecurity",
      controller: "admin",
      refresh: "wait_for",
    });
  }

  resetDatabase() {
    return this.send({
      action: "resetDatabase",
      controller: "admin",
    });
  }

  loadMappings(body) {
    return this.send({
      action: "loadMappings",
      body,
      controller: "admin",
      refresh: "wait_for",
    });
  }

  loadFixtures(body) {
    return this.send({
      action: "loadFixtures",
      body,
      controller: "admin",
      refresh: "wait_for",
    });
  }

  loadSecurities(body) {
    return this.send({
      action: "loadSecurities",
      body,
      controller: "admin",
      refresh: "wait_for",
    });
  }
}
