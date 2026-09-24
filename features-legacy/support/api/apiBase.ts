/**
 * This file contains the main API method for real-time protocols.
 * Avoid to add a new function in each api protocols when a new action in Kuzzle is added.
 *
 * NOTE: must be added in api HTTP because the apiHttp file doesn't extend this ApiRT
 */

import type { JSONObject } from "kuzzle-sdk";

import Bluebird from "bluebird";

type ApiMessage = Record<string, any>;

/**
 * A Kuzzle API response as the step definitions read it. Named rather than
 * spelled out at each of the ~120 call sites: the suite asserts on `.result`,
 * `.error` and `.status` by hand, and pinning a shape here would be inventing
 * one that no step definition agrees to.
 */
type ApiResponse = Record<string, any>;

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

  abstract send(
    msg: ApiMessage,
    getAnswer?: boolean,
    socketName?: string,
  ): Promise<ApiResponse>;

  abstract sendAndListen(
    msg: ApiMessage,
    socketName?: string,
  ): Promise<ApiResponse>;

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

  bulkImport(bulk: JSONObject[], index: string, collection: string) {
    const msg = {
      action: "import",
      body: { bulkData: bulk },
      collection: collection || this.world.fakeCollection,
      controller: "bulk",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  bulkMWrite(index: string, collection: string, body: JSONObject) {
    const msg = {
      action: "mWrite",
      body,
      collection: collection || this.world.fakeCollection,
      controller: "bulk",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  bulkWrite(index: string, collection: string, body: JSONObject, _id = null) {
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

  collectionExists(index: string, collection: string) {
    return this.send({
      action: "exists",
      collection,
      controller: "collection",
      index,
    });
  }

  callMemoryStorage(command: string, args: JSONObject) {
    // `ApiMessage`, not an inferred literal: the loop below writes keys that
    // are only known at runtime, which an inferred literal type has no index
    // signature for.
    const msg: ApiMessage = {
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

  checkToken(token: string) {
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
      .then((response: ApiResponse) => {
        if (_token !== null) {
          this.world.currentUser.token = _token;
        }

        return response;
      })
      .catch((error: Error) => {
        if (_token !== null) {
          this.world.currentUser.token = _token;
        }

        return Bluebird.reject(error);
      });
  }

  count(query: JSONObject, index: string, collection: string) {
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

  createIndex(index: string) {
    const msg = {
      action: "create",
      controller: "index",
      index: index,
    };

    return this.send(msg);
  }

  createCollection(index: string, collection: string, mappings: JSONObject) {
    const msg = {
      action: "create",
      body: mappings,
      collection,
      controller: "collection",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  getCollectionMapping(
    index: string,
    collection: string,
    includeKuzzleMeta = false,
  ) {
    const msg = {
      action: "getMapping",
      collection,
      controller: "collection",
      includeKuzzleMeta,
      index,
    };

    return this.send(msg);
  }

  createCredentials(strategy: string, userId: string, body: JSONObject) {
    return this.send({
      _id: userId,
      action: "createCredentials",
      body,
      controller: "security",
      strategy,
    });
  }

  createMyCredentials(strategy: string, body: JSONObject) {
    return this.send({
      action: "createMyCredentials",
      body,
      controller: "auth",
      strategy,
    });
  }

  createOrReplace(body: JSONObject, index: string, collection: string) {
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

  createOrReplaceProfile(id: string, body: JSONObject) {
    const msg = {
      _id: id,
      action: "createOrReplaceProfile",
      body: body,
      controller: "security",
    };

    return this.send(msg);
  }

  createOrReplaceRole(id: string, body: JSONObject) {
    const msg = {
      _id: id,
      action: "createOrReplaceRole",
      body: body,
      controller: "security",
    };

    return this.send(msg);
  }

  createRestrictedUser(body: JSONObject, id: string) {
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

  createUser(body: JSONObject, id: string) {
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

  createFirstAdmin(body: JSONObject, id: string, reset: boolean) {
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

  credentialsExist(strategy: string, body: JSONObject) {
    return this.send({
      action: "credentialsExist",
      body,
      controller: "auth",
      strategy,
    });
  }

  deleteById(id: string, index: string) {
    const msg = {
      _id: id,
      action: "delete",
      collection: this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  deleteByQuery(query: JSONObject, index: string, collection: string) {
    const msg = {
      action: "deleteByQuery",
      body: query,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  deleteCredentials(strategy: string, userId: string) {
    return this.send({
      _id: userId,
      action: "deleteCredentials",
      controller: "security",
      strategy,
    });
  }

  deleteIndex(index: string) {
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

  deleteMyCredentials(strategy: string) {
    return this.send({
      action: "deleteMyCredentials",
      controller: "auth",
      strategy,
    });
  }

  deleteProfile(id: string, waitFor = false) {
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

  deleteProfiles(ids: string[], waitFor = false) {
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

  deleteRole(id: string, waitFor = false) {
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

  deleteRoles(ids: string[], waitFor = false) {
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

  deleteSpecifications(index: string, collection: string) {
    return this.send({
      action: "deleteSpecifications",
      body: null,
      collection: collection,
      controller: "collection",
      index: index,
    });
  }

  deleteUser(id: string, waitFor = false) {
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

  deleteUsers(ids: string[], waitFor = false) {
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

  exists(id: string, index: string) {
    const msg = {
      _id: id,
      action: "exists",
      collection: this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  get(id: string, index: string, collection: string) {
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

  getCredentials(strategy: string, userId: string) {
    return this.send({
      _id: userId,
      action: "getCredentials",
      controller: "security",
      strategy,
    });
  }

  getCredentialsById(strategy: string, userId: string) {
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

  getMyCredentials(strategy: string) {
    return this.send({
      action: "getMyCredentials",
      controller: "auth",
      strategy,
    });
  }

  getMyRights(id: string) {
    return this.send({
      _id: id,
      action: "getMyRights",
      controller: "auth",
    });
  }

  getProfile(id: string) {
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

  getProfileRights(id: string) {
    const msg = {
      _id: id,
      action: "getProfileRights",
      controller: "security",
    };

    return this.send(msg);
  }

  getRole(id: string) {
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

  getSpecifications(index: string, collection: string) {
    return this.send({
      action: "getSpecifications",
      collection: collection,
      controller: "collection",
      index: index,
    });
  }

  getStats(dates: JSONObject) {
    const msg = {
      action: "getStats",
      body: dates,
      controller: "server",
    };

    return this.send(msg);
  }

  getUser(id: string) {
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

  getUserRights(id: string) {
    return this.send({
      _id: id,
      action: "getUserRights",
      controller: "security",
    });
  }

  hasCredentials(strategy: string, userId: string) {
    return this.send({
      _id: userId,
      action: "hasCredentials",
      controller: "security",
      strategy,
    });
  }

  indexExists(index: string) {
    return this.send({
      action: "exists",
      controller: "index",
      index,
    });
  }

  refreshCollection(index: string, collection: string) {
    const msg = {
      action: "refresh",
      collection: collection || this.world.fakeCollection,
      controller: "collection",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  listCollections(index: string, type: string) {
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

  login(strategy: string, credentials: JSONObject) {
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

  logout(jwtToken: string, global = false) {
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

  mCreate(
    body: JSONObject,
    index: string,
    collection: string,
    jwtToken: string,
  ) {
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

  mCreateOrReplace(body: JSONObject, index: string, collection: string) {
    const msg = {
      action: "mCreateOrReplace",
      body: body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  mDelete(body: JSONObject, index: string, collection: string) {
    const msg = {
      action: "mDelete",
      body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  mGet(body: JSONObject, index: string, collection: string) {
    const msg = {
      action: "mGet",
      body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  mGetProfiles(body: JSONObject) {
    const msg = {
      action: "mGetProfiles",
      body: body,
      controller: "security",
    };

    return this.send(msg);
  }

  mGetRoles(body: JSONObject) {
    const msg = {
      action: "mGetRoles",
      body: body,
      controller: "security",
    };

    return this.send(msg);
  }

  mReplace(body: JSONObject, index: string, collection: string) {
    const msg = {
      action: "mReplace",
      body: body,
      collection: collection || this.world.fakeCollection,
      controller: "document",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  mUpdate(body: JSONObject, index: string, collection: string) {
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

  postDocument(index: string, collection: string, document: JSONObject) {
    return this.send({
      action: "create",
      body: document,
      collection,
      controller: "document",
      index,
    });
  }

  publish(body: JSONObject, index: string) {
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

  replace(body: JSONObject, index: string, collection: string) {
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

  replaceUser(id: string, body: JSONObject) {
    return this.send({
      _id: id,
      action: "replaceUser",
      body,
      controller: "security",
    });
  }

  revokeTokens(id: string) {
    return this.send({
      _id: id,
      action: "revokeTokens",
      controller: "security",
    });
  }

  scroll(scrollId: string, scroll: string) {
    const msg = {
      action: "scroll",
      controller: "document",
      scroll,
      scrollId,
    };

    return this.send(msg);
  }

  scrollProfiles(scrollId: string) {
    return this.send({
      action: "scrollProfiles",
      controller: "security",
      scrollId,
    });
  }

  scrollSpecifications(scrollId: string) {
    return this.send({
      action: "scrollSpecifications",
      controller: "collection",
      scrollId,
    });
  }

  scrollUsers(scrollId: string) {
    return this.send({
      action: "scrollUsers",
      controller: "security",
      scrollId,
    });
  }

  search(
    query: JSONObject,
    index: string,
    collection: string,
    args: JSONObject,
  ) {
    const msg: ApiMessage = {
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

  searchProfiles(roles: string[], args: JSONObject) {
    const msg: ApiMessage = {
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

  searchRoles(body: JSONObject, args: JSONObject) {
    const msg: ApiMessage = {
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

  searchSpecifications(body: JSONObject, args: JSONObject) {
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

  searchUsers(query: JSONObject, args: JSONObject) {
    const msg: ApiMessage = {
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

  subscribe(filters: JSONObject, client: string, authentified = false) {
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

  truncateCollection(index: string, collection: string) {
    const msg = {
      action: "truncate",
      collection: collection || this.world.fakeCollection,
      controller: "collection",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  unsubscribe(room: string, clientId: string) {
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

  update(id: string, body: JSONObject, index: string, collection: string) {
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

  updateCredentials(strategy: string, userId: string, body: JSONObject) {
    return this.send({
      _id: userId,
      action: "updateCredentials",
      body,
      controller: "security",
      strategy,
    });
  }

  updateMapping(index: string, collection: string, mapping: JSONObject) {
    const msg = {
      action: "updateMapping",
      body: mapping || this.world.mapping,
      collection: collection || this.world.fakeCollection,
      controller: "collection",
      index: index || this.world.fakeIndex,
    };

    return this.send(msg);
  }

  updateMyCredentials(strategy: string, body: JSONObject) {
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

  updateSelf(body: JSONObject) {
    return this.send({
      action: "updateSelf",
      body: body,
      controller: "auth",
    });
  }

  updateSpecifications(
    index: string,
    collection: string,
    specifications: JSONObject,
  ) {
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

  validateCredentials(strategy: string, userId: string, body: JSONObject) {
    return this.send({
      _id: userId,
      action: "validateCredentials",
      body,
      controller: "security",
      strategy,
    });
  }

  validateDocument(index: string, collection: string, document: JSONObject) {
    return this.create(document, index, collection);
  }

  validateMyCredentials(strategy: string, body: JSONObject) {
    return this.send({
      action: "validateMyCredentials",
      body,
      controller: "auth",
      strategy,
    });
  }

  validateSpecifications(
    index: string,
    collection: string,
    specifications: JSONObject,
  ) {
    return this.send({
      action: "validateSpecifications",
      body: specifications,
      collection,
      controller: "collection",
      index,
    });
  }

  resetCache(database: string) {
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

  loadMappings(body: JSONObject) {
    return this.send({
      action: "loadMappings",
      body,
      controller: "admin",
      refresh: "wait_for",
    });
  }

  loadFixtures(body: JSONObject) {
    return this.send({
      action: "loadFixtures",
      body,
      controller: "admin",
      refresh: "wait_for",
    });
  }

  loadSecurities(body: JSONObject) {
    return this.send({
      action: "loadSecurities",
      body,
      controller: "admin",
      refresh: "wait_for",
    });
  }
}
