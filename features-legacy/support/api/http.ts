import * as zlib from "zlib";
import _ from "lodash";
import type { JSONObject } from "kuzzle-sdk";
import rp from "request-promise";

import routes from "../../../lib/api/httpRoutes";
import type KWorld from "../world";

type CompressionAlgorithm = "identity" | "gzip" | "deflate";

type HttpRequestOptions = {
  url: string;
  method: string;
  body?: any;
  headers?: Record<string, any>;
  gzip?: boolean;
  json?: boolean;
  forever?: boolean;
  form?: any;
  formData?: any;
  [key: string]: any;
};

function checkAlgorithm(algorithm: CompressionAlgorithm | string) {
  const supported: CompressionAlgorithm[] = ["identity", "gzip", "deflate"],
    list = algorithm.split(",").map((a) => a.trim().toLowerCase());

  for (const l of list) {
    if (!supported.some((a) => a === l)) {
      throw new Error(`Unsupported compression algorithm: ${l}`);
    }
  }
}

export default class HttpApi {
  world: KWorld;
  baseUri: string;
  util: {
    getIndex: (index?: string | null) => string;
    getCollection: (collection?: string | null) => string;
  };
  isRealtimeCapable: boolean;
  encoding: CompressionAlgorithm | string;
  expectedEncoding: CompressionAlgorithm | string;

  constructor(world: KWorld) {
    this.world = world;

    this.baseUri = `http://${world.config.host}:${world.config.port}`;

    this.util = {
      getCollection: (collection) =>
        typeof collection !== "string" ? this.world.fakeCollection : collection,
      getIndex: (index) =>
        typeof index !== "string" ? this.world.fakeIndex : index,
    };

    this.isRealtimeCapable = false;

    this.encoding = "identity";
    this.expectedEncoding = "identity";
  }

  _getRequest({
    index = null,
    collection = null,
    controller,
    action,
    args,
  }: {
    index?: string | null;
    collection?: string | null;
    controller: string;
    action: string;
    args?: any;
  }): HttpRequestOptions {
    let url = "";
    let verb = "GET";
    const queryString: string[] = [];

    const requestArgs = args ? { ...args } : {};
    if (!requestArgs.body) {
      requestArgs.body = requestArgs.args ? requestArgs.args : {};
    }

    routes.some((route) => {
      const hits: string[] = [];

      // Try / Catch mechanism avoids to match routes that have not all
      // the mandatory arguments for the route
      try {
        if (route.controller === controller && route.action === action) {
          verb = route.verb.toUpperCase();

          // `route.path`, not `route.url`: the two are the same string —
          // httpRoutes.ts ends with `route.url = route.path` and documents `url`
          // as a deprecated alias — but only `path` is declared non-optional, and
          // reading the alias means asserting a population step this file cannot
          // see.
          url = route.path
            .replace(/(:[^/]+)/g, function (match) {
              hits.push(match.substring(1));

              if (match === ":index") {
                if (!index) {
                  throw new Error("No index provided");
                }
                return index;
              }
              if (match === ":collection") {
                if (!collection) {
                  throw new Error("No collection provided");
                }
                return collection;
              }

              if (match === ":_id") {
                if (requestArgs._id) {
                  return requestArgs._id;
                }
                if (requestArgs.body._id) {
                  return requestArgs.body._id;
                }
                throw new Error("No _id provided");
              }

              if (requestArgs.body[match.substring(1)] !== undefined) {
                return requestArgs.body[match.substring(1)];
              }

              return "";
            })
            .substring(1);

          // add extra arguments in the query string
          if (verb === "GET") {
            for (const key of _.difference(
              Object.keys(requestArgs.body),
              hits,
            )) {
              const value = requestArgs.body[key];

              if (value !== undefined) {
                if (Array.isArray(value)) {
                  queryString.push(...value.map((v) => `${key}=${v}`));
                } else {
                  queryString.push(`${key}=${value}`);
                }
              }
            }

            if (queryString.length) {
              url += "?" + queryString.join("&");
            }
          }

          url = url.replace(/\/\//g, "/").replace(/\/$/, "");

          return true;
        }
      } catch {
        return false;
      }

      return false;
    });

    const result: HttpRequestOptions = {
      method: verb,
      url: this.apiPath(url),
    };

    if (verb !== "GET") {
      result.body = requestArgs.body;
    }

    return result;
  }

  apiBasePath(path: string) {
    return this.apiPath(path);
  }

  apiPath(path: string) {
    return path.startsWith("/")
      ? encodeURI(`${this.baseUri}${path}`)
      : encodeURI(`${this.baseUri}/${path}`);
  }

  adminResetDatabase() {
    return this.callApi({
      method: "POST",
      url: this.apiPath("/admin/_resetDatabase/"),
    });
  }

  serverPublicApi() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("/_publicApi"),
    });
  }

  bulkImport(bulk: JSONObject[], index?: string) {
    return this.callApi({
      body: { bulkData: bulk },
      method: "POST",
      url: this.apiPath(
        this.util.getIndex(index) + "/" + this.world.fakeCollection + "/_bulk",
      ),
    });
  }

  bulkMWrite(index: string, collection: string, body: JSONObject) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_mWrite",
      ),
    });
  }

  bulkWrite(index: string, collection: string, body: JSONObject, _id = null) {
    let url = `${this.util.getIndex(index)}/${this.util.getCollection(collection)}/_write`;

    if (_id) {
      url += `?_id=${_id}`;
    }

    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath(url),
    });
  }

  /**
   * @param options
   * @returns {Promise.<IncomingMessage>}
   */
  async callApi(options: HttpRequestOptions): Promise<any> {
    if (!options.headers) {
      options.headers = {};
    }

    if (this.world.currentUser && this.world.currentUser.token) {
      options.headers = _.extend(options.headers, {
        authorization: `Bearer ${this.world.currentUser.token}`,
      });
    }

    if (options.body && this.encoding !== "identity") {
      options.body = JSON.stringify(options.body);
      options.headers["content-encoding"] = this.encoding;

      const algorithms = this.encoding
        .split(",")
        .map((a) => a.trim().toLowerCase());

      for (const algorithm of algorithms) {
        if (algorithm === "gzip") {
          options.body = zlib.gzipSync(options.body);
        } else if (algorithm === "deflate") {
          options.body = zlib.deflateSync(options.body);
        }
      }
    } else {
      options.json = true;
    }

    if (this.expectedEncoding !== "identity") {
      options.headers["accept-encoding"] = this.expectedEncoding;

      // despite the name, that options asks "request" to handle
      // both gzip or deflate compressed responses
      options.gzip = true;
    }

    options.forever = true;

    const response = await rp(options);

    // we need to manually parse the stringified json if
    // we sent a compressed buffer through the request module
    if (options.body && this.encoding !== "identity") {
      return JSON.parse(response);
    }

    return response;
  }

  callMemoryStorage(command: string, args: JSONObject) {
    return this.callApi(
      this._getRequest({ action: command, args, controller: "ms" }),
    );
  }

  checkToken(token: string) {
    let _token = null;
    const request = {
      body: { token },
      method: "POST",
      url: this.apiPath("_checkToken"),
    };

    if (this.world.currentUser && this.world.currentUser.token) {
      _token = this.world.currentUser.token;
      this.world.currentUser.token = null;
    }

    return this.callApi(request)
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

        return Promise.reject(error);
      });
  }

  collectionExists(index: string, collection: string) {
    return this.callApi(
      this._getRequest({
        action: "exists",
        collection,
        controller: "collection",
        index,
      }),
    );
  }

  count(query: JSONObject, index?: string, collection?: string) {
    return this.callApi({
      body: query,
      method: "POST",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_count",
      ),
    });
  }

  create(
    body: JSONObject,
    index?: string,
    collection?: string,
    jwtToken?: string,
    id?: string,
  ) {
    const url = id
      ? this.apiPath(
          this.util.getIndex(index) +
            "/" +
            this.util.getCollection(collection) +
            "/" +
            id +
            "/_create",
        )
      : this.apiPath(
          this.util.getIndex(index) +
            "/" +
            this.util.getCollection(collection) +
            "/_create",
        );
    const options: any = {
      body,
      method: "POST",
      url: url,
    };

    if (jwtToken) {
      options.headers = {
        authorization: "Bearer " + jwtToken,
      };
    }

    return this.callApi(options);
  }

  createCollection(
    index: string | undefined,
    collection: string,
    mappings?: JSONObject,
  ) {
    index = index || this.world.fakeIndex;

    return this.callApi({
      body: mappings,
      method: "PUT",
      url: this.apiPath(`${index}/${collection}`),
    });
  }

  getCollectionMapping(
    index: string,
    collection: string,
    includeKuzzleMeta = false,
  ) {
    const url = `${index}/${collection}/_mapping${includeKuzzleMeta ? "?includeKuzzleMeta" : ""}`;

    return this.callApi({
      method: "GET",
      url: this.apiPath(url),
    });
  }

  createCredentials(strategy: string, userId: string, body: JSONObject) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("credentials/" + strategy + "/" + userId + "/_create"),
    });
  }

  createFirstAdmin(body: JSONObject, id?: string, reset?: boolean) {
    const options = {
      body,
      method: "POST",
      url: this.apiPath("_createFirstAdmin"),
    };

    if (id !== undefined) {
      options.url = this.apiPath(`_createFirstAdmin/${id}`);
    }

    if (reset) {
      options.url += "?reset=1";
    }

    return this.callApi(options);
  }

  createIndex(index: string) {
    return this.callApi({
      method: "POST",
      url: this.apiPath(index + "/_create"),
    });
  }

  createMyCredentials(strategy: string, body: JSONObject) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("credentials/" + strategy + "/_me/_create"),
    });
  }

  createOrReplace(body: JSONObject, index?: string, collection?: string) {
    const options = {
      body,
      method: "PUT",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/" +
          body._id,
      ),
    };

    delete body._id;

    return this.callApi(options);
  }

  createOrReplaceProfile(id: string, body: JSONObject) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath("profiles/" + id),
    });
  }

  createOrReplaceRole(id: string, body: JSONObject) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath("roles/" + id),
    });
  }

  createRestrictedUser(body: JSONObject, id: string) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("users/" + id + "/_createRestricted"),
    });
  }

  createUser(body: JSONObject, id: string) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("users/" + id + "/_create" + "?refresh=wait_for"),
    });
  }

  credentialsExist(strategy: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("credentials/" + strategy + "/_me/_exists"),
    });
  }

  deleteById(id: string, index?: string) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath(
        this.util.getIndex(index) + "/" + this.world.fakeCollection + "/" + id,
      ),
    });
  }

  deleteByQuery(query: JSONObject, index?: string, collection?: string) {
    return this.callApi({
      body: query,
      method: "DELETE",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_query",
      ),
    });
  }

  deleteCredentials(strategy: string, userId: string) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath("credentials/" + strategy + "/" + userId),
    });
  }

  deleteIndex(index: string) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath(index),
    });
  }

  deleteIndexes() {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath("_mDelete"),
    });
  }

  deleteMyCredentials(strategy: string) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath("credentials/" + strategy + "/_me"),
    });
  }

  deleteProfile(id: string, waitFor = false) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath(
        "profiles/" + id + (waitFor ? "?refresh=wait_for" : ""),
      ),
    });
  }

  deleteProfiles(ids: string[], waitFor = false) {
    return this.callApi({
      body: {
        ids,
      },
      method: "POST",
      url: this.apiPath(
        "profiles/_mDelete" + (waitFor ? "?refresh=wait_for" : ""),
      ),
    });
  }

  deleteRole(id: string, waitFor = false) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath("roles/" + id + (waitFor ? "?refresh=wait_for" : "")),
    });
  }

  deleteRoles(ids: string[], waitFor = false) {
    return this.callApi({
      body: {
        ids,
      },
      method: "POST",
      url: this.apiPath(
        "roles/_mDelete" + (waitFor ? "?refresh=wait_for" : ""),
      ),
    });
  }

  deleteSpecifications(index: string, collection: string) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath(index + "/" + collection + "/_specifications"),
    });
  }

  deleteUser(id: string, waitFor = false) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath("users/" + id + (waitFor ? "?refresh=wait_for" : "")),
    });
  }

  deleteUsers(ids: string[], waitFor = false) {
    return this.callApi({
      body: {
        ids,
      },
      method: "POST",
      url: this.apiPath(
        "users/_mDelete" + (waitFor ? "?refresh=wait_for" : ""),
      ),
    });
  }

  disconnect() {}

  exists(id: string, index?: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.world.fakeCollection +
          "/" +
          id +
          "/_exists",
      ),
    });
  }

  get(id: string, index?: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath(
        this.util.getIndex(index) + "/" + this.world.fakeCollection + "/" + id,
      ),
    });
  }

  getAllStats() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("_getAllStats"),
    });
  }

  getAuthenticationStrategies() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("strategies"),
    });
  }

  getCredentials(strategy: string, userId: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("credentials/" + strategy + "/" + userId),
    });
  }

  getCredentialsById(strategy: string, userId: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("credentials/" + strategy + "/" + userId + "/_byId"),
    });
  }

  getCurrentUser() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("users/_me"),
    });
  }

  getLastStats() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("_getLastStats"),
    });
  }

  getMyCredentials(strategy: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("credentials/" + strategy + "/_me"),
    });
  }

  getMyRights() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("users/_me/_rights"),
    });
  }

  getProfile(id: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("profiles/" + id),
    });
  }

  getProfileMapping() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("/profiles/_mapping"),
    });
  }

  getProfileRights(id: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("profiles/" + id + "/_rights"),
    });
  }

  getRole(id: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("roles/" + id),
    });
  }

  getRoleMapping() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("/roles/_mapping"),
    });
  }

  getSpecifications(index: string, collection: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath(index + "/" + collection + "/_specifications"),
    });
  }

  getStats(dates: JSONObject) {
    return this.callApi(
      this._getRequest({
        action: "getStats",
        args: { body: dates },
        controller: "server",
      }),
    );
  }

  getUser(id: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("users/" + id),
    });
  }

  getUserMapping() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("/users/_mapping"),
    });
  }

  getUserRights(id: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("users/" + id + "/_rights"),
    });
  }

  hasCredentials(strategy: string, userId: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("credentials/" + strategy + "/" + userId + "/_exists"),
    });
  }

  indexExists(index: string) {
    return this.callApi(
      this._getRequest({ action: "exists", controller: "index", index }),
    );
  }

  refreshCollection(index?: string, collection?: string) {
    const _index = index || this.world.fakeIndex,
      _collection = collection || this.world.fakeCollection,
      options = {
        method: "POST",
        url: this.apiPath(`${_index}/${_collection}/_refresh`),
      };

    return this.callApi(options);
  }

  listCollections(index?: string, type?: string) {
    const options = {
      method: "GET",
      url: this.apiPath(`${index || this.world.fakeIndex}/_list`),
    };
    if (type) {
      options.url += "?type=" + type;
    }

    return this.callApi(options);
  }

  listIndexes() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("_list"),
    });
  }

  login(strategy: string, credentials: JSONObject) {
    return this.callApi({
      body: {
        password: credentials.password,
        username: credentials.username,
      },
      method: "POST",
      url: this.apiPath(`_login/${strategy}`),
    });
  }

  logout(jwtToken: string) {
    return this.callApi({
      headers: {
        authorization: "Bearer " + jwtToken,
      },
      method: "POST",
      url: this.apiPath("_logout"),
    });
  }

  mCreate(
    body: JSONObject,
    index?: string,
    collection?: string,
    jwtToken?: string,
  ) {
    const options: any = {
      body,
      method: "POST",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_mCreate",
      ),
    };

    if (jwtToken) {
      options.headers = {
        authorization: "Bearer " + jwtToken,
      };
    }

    return this.callApi(options);
  }

  mCreateOrReplace(body: JSONObject, index?: string, collection?: string) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_mCreateOrReplace",
      ),
    });
  }

  mDelete(body: JSONObject, index?: string, collection?: string) {
    return this.callApi({
      body,
      method: "DELETE",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_mDelete",
      ),
    });
  }

  mGet(body: JSONObject, index?: string, collection?: string) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_mGet",
      ),
    });
  }

  mGetProfiles(body: JSONObject) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("profiles/_mGet"),
    });
  }

  mGetRoles(body: JSONObject) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("roles/_mGet"),
    });
  }

  mReplace(body: JSONObject, index?: string, collection?: string) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_mReplace",
      ),
    });
  }

  mUpdate(body: JSONObject, index?: string, collection?: string) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_mUpdate",
      ),
    });
  }

  now() {
    return this.callApi({
      method: "GET",
      url: this.apiPath("_now"),
    });
  }

  postDocument(index: string, collection: string, document: JSONObject) {
    return this.callApi({
      body: document,
      method: "POST",
      url: this.apiPath(index + "/" + collection + "/_create"),
    });
  }

  publish(body: JSONObject, index?: string) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.world.fakeCollection +
          "/_publish",
      ),
    });
  }

  refreshToken() {
    return this.callApi({
      method: "POST",
      url: this.apiPath("_refreshToken"),
    });
  }

  replace(body: JSONObject, index?: string, collection?: string) {
    const options = {
      body,
      method: "PUT",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/" +
          body._id +
          "/_replace",
      ),
    };

    delete body._id;

    return this.callApi(options);
  }

  replaceUser(id: string, body: JSONObject) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath("users/" + id + "/_replace"),
    });
  }

  revokeTokens(id: string) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath(`users/${id}/tokens`),
    });
  }

  scroll(scrollId: string, scroll?: string) {
    const options = {
      method: "GET",
      url: this.apiPath(`_scroll/${scrollId}`),
    };

    if (scroll) {
      options.url += "?scroll=" + scroll;
    }

    return this.callApi(options);
  }

  scrollProfiles(scrollId: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("profiles/_scroll/" + scrollId),
    });
  }

  scrollSpecifications(scrollId: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("validations/_scroll/" + scrollId),
    });
  }

  scrollUsers(scrollId: string) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("users/_scroll/" + scrollId),
    });
  }

  search(
    query: JSONObject,
    index?: string,
    collection?: string,
    args?: JSONObject,
  ) {
    const options = {
      body: query,
      method: "POST",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_search",
      ),
    };

    if (args) {
      const qs = [];
      options.url += "?";

      if (args.scroll) {
        qs.push("scroll=" + args.scroll);
      }
      if (args.from) {
        qs.push("from=" + args.from);
      }
      if (args.size) {
        qs.push("size=" + args.size);
      }

      options.url += qs.join("&");
    }

    return this.callApi(options);
  }

  searchProfiles(roles: string[], args?: JSONObject) {
    const options = {
      body: {
        roles,
      },
      method: "POST",
      url: this.apiPath("profiles/_search"),
    };

    if (args) {
      let first = true;
      for (const arg of Object.keys(args)) {
        options.url += (first ? "?" : "&") + `${arg}=${args[arg]}`;
        first = false;
      }
    }

    return this.callApi(options);
  }

  searchRoles(body: JSONObject, args?: JSONObject) {
    const options = {
      body,
      method: "POST",
      url: this.apiPath("roles/_search"),
    };

    if (args) {
      const qs = [];
      options.url += "?";

      if (args.from) {
        qs.push("from=" + args.from);
      }
      if (args.size) {
        qs.push("size=" + args.size);
      }

      options.url += qs.join("&");
    }

    return this.callApi(options);
  }

  searchSpecifications(body: JSONObject, args?: JSONObject) {
    const options = {
      body,
      method: "POST",
      url: this.apiPath("validations/_search"),
    };

    if (args) {
      let first = true;
      for (const arg of Object.keys(args)) {
        options.url += (first ? "?" : "&") + `${arg}=${args[arg]}`;
        first = false;
      }
    }

    return this.callApi(options);
  }

  searchUsers(query: JSONObject, args?: JSONObject) {
    const options = {
      body: {
        query,
      },
      method: "POST",
      url: this.apiPath("users/_search"),
    };

    if (args) {
      let first = true;
      for (const arg of Object.keys(args)) {
        options.url += (first ? "?" : "&") + `${arg}=${args[arg]}`;
        first = false;
      }
    }

    return this.callApi(options);
  }

  truncateCollection(index?: string, collection?: string) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath(
        this.util.getIndex(index) +
          "/" +
          this.util.getCollection(collection) +
          "/_truncate",
      ),
    });
  }

  update(id: string, body: JSONObject, index?: string, collection?: string) {
    const _collection = collection || this.world.fakeCollection,
      options = {
        body,
        method: "PUT",
        url: this.apiPath(
          `${this.util.getIndex(index)}/${_collection}/${id}/_update`,
        ),
      };

    delete body._id;

    return this.callApi(options);
  }

  updateCredentials(strategy: string, userId: string, body: JSONObject) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath("credentials/" + strategy + "/" + userId + "/_update"),
    });
  }

  updateProfileMapping() {
    return this.callApi({
      body: this.world.securitymapping,
      method: "PUT",
      url: this.apiPath("/profiles/_mapping"),
    });
  }

  updateMapping(index?: string, collection?: string, mapping?: JSONObject) {
    return this.callApi({
      body: mapping || this.world.mapping,
      method: "PUT",
      url: `${this.apiPath(this.util.getIndex(index))}/${collection || this.world.fakeCollection}/_mapping`,
    });
  }

  updateMyCredentials(strategy: string, body: JSONObject) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath("credentials/" + strategy + "/_me/_update"),
    });
  }

  updateRoleMapping() {
    return this.callApi({
      body: this.world.securitymapping,
      method: "PUT",
      url: this.apiPath("/roles/_mapping"),
    });
  }

  updateSelf(body: JSONObject) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath("_updateSelf"),
    });
  }

  updateSpecifications(
    index: string,
    collection: string,
    specifications: JSONObject,
  ) {
    return this.callApi({
      body: specifications,
      method: "PUT",
      url: this.apiPath(`${index}/${collection}/_specifications`),
    });
  }

  updateUserMapping() {
    return this.callApi({
      body: this.world.securitymapping,
      method: "PUT",
      url: this.apiPath("/users/_mapping"),
    });
  }

  validateCredentials(strategy: string, userId: string, body: JSONObject) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath(
        "credentials/" + strategy + "/" + userId + "/_validate",
      ),
    });
  }

  validateDocument(index: string, collection: string, document: JSONObject) {
    return this.callApi({
      body: document,
      method: "POST",
      url: this.apiPath(index + "/" + collection + "/_validate"),
    });
  }

  validateMyCredentials(strategy: string, body: JSONObject) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("credentials/" + strategy + "/_me/_validate"),
    });
  }

  validateSpecifications(
    index: string,
    collection: string,
    specifications: JSONObject,
  ) {
    return this.callApi({
      body: specifications,
      method: "POST",
      url: this.apiPath(
        index
          ? `${index}/${collection}/_validateSpecifications`
          : "_validateSpecifications",
      ),
    });
  }

  resetCache(database: string) {
    return this.callApi({
      method: "POST",
      url: this.apiPath(`admin/_resetCache/${database}`),
    });
  }

  resetKuzzleData() {
    return this.callApi({
      method: "POST",
      url: this.apiPath("admin/_resetKuzzleData"),
    });
  }

  resetSecurity() {
    return this.callApi({
      body: {
        refresh: "wait_for",
      },
      method: "POST",
      url: this.apiPath("admin/_resetSecurity"),
    });
  }

  resetDatabase() {
    return this.callApi({
      method: "POST",
      url: this.apiPath("admin/_resetDatabase"),
    });
  }

  loadMappings(body: JSONObject) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("admin/_loadMappings?refresh=wait_for"),
    });
  }

  loadFixtures(body: JSONObject) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("admin/_loadFixtures?refresh=wait_for"),
    });
  }

  loadSecurities(body: JSONObject) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("admin/_loadSecurities?refresh=wait_for"),
    });
  }

  encode(algorithm: CompressionAlgorithm | string) {
    checkAlgorithm(algorithm);
    this.encoding = algorithm;
  }

  decode(algorithm: CompressionAlgorithm | string) {
    checkAlgorithm(algorithm);
    this.expectedEncoding = algorithm;
  }

  urlEncodedCreate(form: Record<string, any>) {
    return this.callApi({
      form,
      method: "POST",
      url: this.apiPath(
        `${this.world.fakeIndex}/${this.world.fakeCollection}/_create`,
      ),
    });
  }

  multipartCreate(formData: Record<string, any>) {
    return this.callApi({
      formData,
      method: "POST",
      url: this.apiPath(
        `${this.world.fakeIndex}/${this.world.fakeCollection}/_create`,
      ),
    });
  }
}
