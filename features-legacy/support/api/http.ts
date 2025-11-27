import * as zlib from "zlib";
import _ from "lodash";
import rp from "request-promise";

import routes from "../../../lib/api/httpRoutes";
import KWorld from "../world";

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
      const hits = [];

      // Try / Catch mechanism avoids to match routes that have not all
      // the mandatory arguments for the route
      try {
        if (route.controller === controller && route.action === action) {
          verb = route.verb.toUpperCase();

          url = route.url
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
      } catch (error) {
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

  bulkImport(bulk, index) {
    return this.callApi({
      body: { bulkData: bulk },
      method: "POST",
      url: this.apiPath(
        this.util.getIndex(index) + "/" + this.world.fakeCollection + "/_bulk",
      ),
    });
  }

  bulkMWrite(index, collection, body) {
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

  bulkWrite(index, collection, body, _id = null) {
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

  callMemoryStorage(command, args) {
    return this.callApi(
      this._getRequest({ action: command, args, controller: "ms" }),
    );
  }

  checkToken(token) {
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

  collectionExists(index, collection) {
    return this.callApi(
      this._getRequest({
        action: "exists",
        collection,
        controller: "collection",
        index,
      }),
    );
  }

  count(query, index, collection) {
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

  create(body, index, collection, jwtToken, id) {
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

  createCollection(index, collection, mappings) {
    index = index || this.world.fakeIndex;

    return this.callApi({
      body: mappings,
      method: "PUT",
      url: this.apiPath(`${index}/${collection}`),
    });
  }

  getCollectionMapping(index, collection, includeKuzzleMeta = false) {
    const url = `${index}/${collection}/_mapping${includeKuzzleMeta ? "?includeKuzzleMeta" : ""}`;

    return this.callApi({
      method: "GET",
      url: this.apiPath(url),
    });
  }

  createCredentials(strategy, userId, body) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("credentials/" + strategy + "/" + userId + "/_create"),
    });
  }

  createFirstAdmin(body, id, reset) {
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

  createIndex(index) {
    return this.callApi({
      method: "POST",
      url: this.apiPath(index + "/_create"),
    });
  }

  createMyCredentials(strategy, body) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("credentials/" + strategy + "/_me/_create"),
    });
  }

  createOrReplace(body, index, collection) {
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

  createOrReplaceProfile(id, body) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath("profiles/" + id),
    });
  }

  createOrReplaceRole(id, body) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath("roles/" + id),
    });
  }

  createRestrictedUser(body, id) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("users/" + id + "/_createRestricted"),
    });
  }

  createUser(body, id) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("users/" + id + "/_create" + "?refresh=wait_for"),
    });
  }

  credentialsExist(strategy) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("credentials/" + strategy + "/_me/_exists"),
    });
  }

  deleteById(id, index) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath(
        this.util.getIndex(index) + "/" + this.world.fakeCollection + "/" + id,
      ),
    });
  }

  deleteByQuery(query, index, collection) {
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

  deleteCredentials(strategy, userId) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath("credentials/" + strategy + "/" + userId),
    });
  }

  deleteIndex(index) {
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

  deleteMyCredentials(strategy) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath("credentials/" + strategy + "/_me"),
    });
  }

  deleteProfile(id, waitFor = false) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath(
        "profiles/" + id + (waitFor ? "?refresh=wait_for" : ""),
      ),
    });
  }

  deleteProfiles(ids, waitFor = false) {
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

  deleteRole(id, waitFor = false) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath("roles/" + id + (waitFor ? "?refresh=wait_for" : "")),
    });
  }

  deleteRoles(ids, waitFor = false) {
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

  deleteSpecifications(index, collection) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath(index + "/" + collection + "/_specifications"),
    });
  }

  deleteUser(id, waitFor = false) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath("users/" + id + (waitFor ? "?refresh=wait_for" : "")),
    });
  }

  deleteUsers(ids, waitFor = false) {
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

  exists(id, index) {
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

  get(id, index) {
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

  getCredentials(strategy, userId) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("credentials/" + strategy + "/" + userId),
    });
  }

  getCredentialsById(strategy, userId) {
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

  getMyCredentials(strategy) {
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

  getProfile(id) {
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

  getProfileRights(id) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("profiles/" + id + "/_rights"),
    });
  }

  getRole(id) {
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

  getSpecifications(index, collection) {
    return this.callApi({
      method: "GET",
      url: this.apiPath(index + "/" + collection + "/_specifications"),
    });
  }

  getStats(dates) {
    return this.callApi(
      this._getRequest({
        action: "getStats",
        args: { body: dates },
        controller: "server",
      }),
    );
  }

  getUser(id) {
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

  getUserRights(id) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("users/" + id + "/_rights"),
    });
  }

  hasCredentials(strategy, userId) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("credentials/" + strategy + "/" + userId + "/_exists"),
    });
  }

  indexExists(index) {
    return this.callApi(
      this._getRequest({ action: "exists", controller: "index", index }),
    );
  }

  refreshCollection(index, collection) {
    const _index = index || this.world.fakeIndex,
      _collection = collection || this.world.fakeCollection,
      options = {
        method: "POST",
        url: this.apiPath(`${_index}/${_collection}/_refresh`),
      };

    return this.callApi(options);
  }

  listCollections(index, type) {
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

  login(strategy, credentials) {
    return this.callApi({
      body: {
        password: credentials.password,
        username: credentials.username,
      },
      method: "POST",
      url: this.apiPath(`_login/${strategy}`),
    });
  }

  logout(jwtToken) {
    return this.callApi({
      headers: {
        authorization: "Bearer " + jwtToken,
      },
      method: "POST",
      url: this.apiPath("_logout"),
    });
  }

  mCreate(body, index, collection, jwtToken) {
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

  mCreateOrReplace(body, index, collection) {
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

  mDelete(body, index, collection) {
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

  mGet(body, index, collection) {
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

  mGetProfiles(body) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("profiles/_mGet"),
    });
  }

  mGetRoles(body) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("roles/_mGet"),
    });
  }

  mReplace(body, index, collection) {
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

  mUpdate(body, index, collection) {
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

  postDocument(index, collection, document) {
    return this.callApi({
      body: document,
      method: "POST",
      url: this.apiPath(index + "/" + collection + "/_create"),
    });
  }

  publish(body, index) {
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

  replace(body, index, collection) {
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

  replaceUser(id, body) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath("users/" + id + "/_replace"),
    });
  }

  revokeTokens(id) {
    return this.callApi({
      method: "DELETE",
      url: this.apiPath(`users/${id}/tokens`),
    });
  }

  scroll(scrollId, scroll) {
    const options = {
      method: "GET",
      url: this.apiPath(`_scroll/${scrollId}`),
    };

    if (scroll) {
      options.url += "?scroll=" + scroll;
    }

    return this.callApi(options);
  }

  scrollProfiles(scrollId) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("profiles/_scroll/" + scrollId),
    });
  }

  scrollSpecifications(scrollId) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("validations/_scroll/" + scrollId),
    });
  }

  scrollUsers(scrollId) {
    return this.callApi({
      method: "GET",
      url: this.apiPath("users/_scroll/" + scrollId),
    });
  }

  search(query, index, collection, args) {
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

  searchProfiles(roles, args) {
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

  searchRoles(body, args) {
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

  searchSpecifications(body, args) {
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

  searchUsers(query, args) {
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

  truncateCollection(index, collection) {
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

  update(id, body, index, collection) {
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

  updateCredentials(strategy, userId, body) {
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

  updateMapping(index, collection, mapping) {
    return this.callApi({
      body: mapping || this.world.mapping,
      method: "PUT",
      url: `${this.apiPath(this.util.getIndex(index))}/${collection || this.world.fakeCollection}/_mapping`,
    });
  }

  updateMyCredentials(strategy, body) {
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

  updateSelf(body) {
    return this.callApi({
      body,
      method: "PUT",
      url: this.apiPath("_updateSelf"),
    });
  }

  updateSpecifications(index, collection, specifications) {
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

  validateCredentials(strategy, userId, body) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath(
        "credentials/" + strategy + "/" + userId + "/_validate",
      ),
    });
  }

  validateDocument(index, collection, document) {
    return this.callApi({
      body: document,
      method: "POST",
      url: this.apiPath(index + "/" + collection + "/_validate"),
    });
  }

  validateMyCredentials(strategy, body) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("credentials/" + strategy + "/_me/_validate"),
    });
  }

  validateSpecifications(index, collection, specifications) {
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

  resetCache(database) {
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

  loadMappings(body) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("admin/_loadMappings?refresh=wait_for"),
    });
  }

  loadFixtures(body) {
    return this.callApi({
      body,
      method: "POST",
      url: this.apiPath("admin/_loadFixtures?refresh=wait_for"),
    });
  }

  loadSecurities(body) {
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
