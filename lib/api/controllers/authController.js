"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const http_1 = require("http");
const cookie_1 = __importDefault(require("cookie"));
const bluebird_1 = __importDefault(require("bluebird"));
const lodash_1 = require("lodash");
const errors_1 = require("../../kerror/errors");
const request_1 = require("../request");
const kerror = __importStar(require("../../kerror"));
const safeObject_1 = require("../../util/safeObject");
const baseController_1 = require("./baseController");
const formatProcessing_1 = __importDefault(require("../../core/auth/formatProcessing"));
const user_1 = require("../../model/security/user");
const apiKey_1 = __importDefault(require("../../model/storage/apiKey"));
const securityController_1 = __importDefault(require("./securityController"));
class AuthController extends baseController_1.NativeController {
    /**
     * @param {Kuzzle} kuzzle
     * @constructor
     */
    constructor() {
        super([
            "checkRights",
            "checkToken",
            "createApiKey",
            "createMyCredentials",
            "createToken",
            "credentialsExist",
            "deleteApiKey",
            "deleteMyCredentials",
            "getCurrentUser",
            "getMyCredentials",
            "getMyRights",
            "getStrategies",
            "login",
            "logout",
            "refreshToken",
            "searchApiKeys",
            "updateMyCredentials",
            "updateSelf",
            "validateMyCredentials",
        ]);
        this.anonymousId = null;
    }
    /**
     * Controller initialization: we need the anonymous user identifier for the
     * "isAuthenticated" assertion
     *
     * @returns {Promise}
     */
    async init() {
        const anonymous = await global.kuzzle.ask("core:security:user:anonymous:get");
        this.anonymousId = anonymous._id;
    }
    async createToken(request) {
        const singleUse = request.getBoolean("singleUse");
        if (`${request.input.args.expiresIn}` === "-1") {
            throw kerror.get("security", "token", "invalid_expiration", "expiresIn", "cannot be infinite");
        }
        const token = await this.ask("core:security:token:create", request.getUser(), {
            expiresIn: request.input.args.expiresIn,
            singleUse,
        });
        return {
            expiresAt: token.expiresAt,
            singleUse: token.singleUse,
            token: token.jwt,
            ttl: token.ttl,
        };
    }
    /**
     * Checks if an API action can be executed by the current user
     */
    async checkRights(request) {
        const requestPayload = request.getBody();
        if (typeof requestPayload.controller !== "string") {
            throw kerror.get("api", "assert", "missing_argument", "body.controller");
        }
        if (typeof requestPayload.action !== "string") {
            throw kerror.get("api", "assert", "missing_argument", "body.action");
        }
        const user = request.context.user;
        const allowed = await user.isActionAllowed(new request_1.KuzzleRequest(requestPayload));
        return {
            allowed,
        };
    }
    /**
     * Creates a new API key for the user
     * @param {KuzzleRequest} request
     */
    async createApiKey(request) {
        const expiresIn = request.input.args.expiresIn || -1;
        const refresh = request.getRefresh("wait_for");
        const apiKeyId = request.getId({ ifMissing: "generate" });
        const description = request.getBodyString("description");
        const user = request.context.user;
        const apiKey = await apiKey_1.default.create(user, expiresIn, description, {
            apiKeyId,
            creatorId: user._id,
            refresh,
        });
        return apiKey.serialize({ includeToken: true });
    }
    /**
     * Search in the user API keys
     */
    async searchApiKeys(request) {
        let query = request.getBody({});
        const { from, size } = request.getSearchParams();
        const lang = request.getLangParam();
        const user = request.context.user;
        if (lang === "koncorde") {
            query = await this.translateKoncorde(query);
        }
        const searchBody = {
            query: {
                bool: {
                    filter: { bool: { must: { term: { userId: user._id } } } },
                    must: (0, lodash_1.isEmpty)(query) ? { match_all: {} } : query,
                },
            },
        };
        const apiKeys = await apiKey_1.default.search(searchBody, { from, size });
        return {
            hits: apiKeys.map((apiKey) => apiKey.serialize()),
            total: apiKeys.length,
        };
    }
    /**
     * Deletes an API key
     */
    async deleteApiKey(request) {
        const apiKeyId = request.getId();
        const refresh = request.getRefresh();
        const apiKey = await apiKey_1.default.load(request.context.user._id, apiKeyId);
        await apiKey.delete({ refresh });
        return { _id: apiKeyId };
    }
    /**
     * Logs the current user out
     *
     * @param {KuzzleRequest} request
     * @returns {Promise<object>}
     */
    async logout(request) {
        if (!global.kuzzle.config.http.cookieAuthentication ||
            !request.getBoolean("cookieAuth")) {
            this.assertIsAuthenticated(request);
        }
        if (global.kuzzle.config.internal.notifiableProtocols.includes(request.context.connection.protocol)) {
            // Unlink connection so the connection will not be notified when the token expires.
            global.kuzzle.tokenManager.unlink(request.context.token, request.context.connection.id);
        }
        if (request.context.user._id !== this.anonymousId) {
            if (request.getBoolean("global")) {
                await global.kuzzle.ask("core:security:token:deleteByKuid", request.getKuid(), { keepApiKeys: true });
            }
            else if (request.context.token &&
                request.context.token.type !== "apiKey") {
                await global.kuzzle.ask("core:security:token:delete", request.context.token);
            }
        }
        if (global.kuzzle.config.http.cookieAuthentication &&
            request.getBoolean("cookieAuth")) {
            request.response.configure({
                headers: {
                    "Set-Cookie": cookie_1.default.serialize("authToken", null, {
                        httpOnly: true,
                        path: "/",
                        sameSite: "strict",
                    }),
                },
            });
        }
        return { acknowledged: true };
    }
    // Used to send the Token using different ways when in cookieAuth mode. (DRY)
    async _sendToken(token, request) {
        // Only if the support of Browser Cookie as Authentication Token is enabled
        // otherwise we should send a normal response because
        // even if the SDK / Browser can handle the cookie,
        // Kuzzle would not be capable of doing anything with it
        if (global.kuzzle.config.http.cookieAuthentication &&
            request.getBoolean("cookieAuth")) {
            // Here we are not sending auth token when cookieAuth is set to true
            // This allow us to detect if kuzzle does support cookie as auth token directly from the SDK
            // or that the version of kuzzle doesn't support the feature Browser Cookie as Authentication Token
            request.response.configure({
                headers: {
                    "Set-Cookie": cookie_1.default.serialize("authToken", token.jwt, {
                        expires: new Date(token.expiresAt),
                        httpOnly: true,
                        path: "/",
                        sameSite: "strict",
                    }),
                },
            });
            return {
                _id: token.userId,
                expiresAt: token.expiresAt,
                ttl: token.ttl,
            };
        }
        return {
            _id: token.userId,
            expiresAt: token.expiresAt,
            jwt: token.jwt,
            ttl: token.ttl,
        };
    }
    /**
     * Attempts a login with request informations against the provided strategy;
     * local is used if strategy is not provided.
     *
     * @param {KuzzleRequest} request
     * @returns {Promise<Token>}
     */
    async login(request) {
        const strategy = request.getString("strategy");
        const passportRequest = new http_1.IncomingMessage(null);
        // Even in http, the url and the method are not pushed back to the request object
        // set some arbitrary values to get a pseudo-valid object.
        passportRequest.url = `/login?strategy=${strategy}`;
        passportRequest.method = "POST";
        passportRequest.httpVersion = "1.1";
        passportRequest.httpVersionMajor = 1;
        passportRequest.httpVersionMinor = 1;
        passportRequest.body = request.input.body;
        passportRequest.query = request.input.args;
        passportRequest.headers = Object.assign({}, request.input.headers);
        for (const h of Object.keys(passportRequest.headers)) {
            passportRequest.rawHeaders.push(h);
            passportRequest.rawHeaders.push(passportRequest.headers[h]);
        }
        passportRequest.original = request;
        if (!(0, safeObject_1.has)(global.kuzzle.pluginsManager.strategies, strategy)) {
            throw kerror.get("security", "credentials", "unknown_strategy", strategy);
        }
        const content = await global.kuzzle.passport.authenticate(passportRequest, strategy);
        // do not trigger the "auth:strategyAutenticated" pipe if the result is
        // not a User object, i.e. if we are a intermediate step of a multi-step
        // authentication strategy
        // (example: first redirection call for oAuth strategies)
        const authResponse = !(content instanceof user_1.User)
            ? { content, strategy }
            : await this.pipe("auth:strategyAuthenticated", { content, strategy });
        if (!(authResponse.content instanceof user_1.User)) {
            request.response.configure({
                headers: authResponse.content.headers,
                status: authResponse.content.statusCode || 200,
            });
            return authResponse.content;
        }
        const options = {};
        if (request.input.args.expiresIn) {
            options.expiresIn = request.input.args.expiresIn;
        }
        const existingToken = global.kuzzle.tokenManager.getConnectedUserToken(authResponse.content._id, request.context.connection.id);
        /**
         * If a previous token from the same User is linked to this connection
         * and the token is either an API Key or an infinite duration token
         * we dont need to create a new token or refresh anything, just send back the exact same token
         * to avoid breaking changes.
         */
        if (existingToken &&
            (existingToken.type === "apiKey" || existingToken.ttl < 0)) {
            return this._sendToken(existingToken, request);
        }
        const token = await this.ask("core:security:token:create", authResponse.content, options);
        if (existingToken) {
            global.kuzzle.tokenManager.refresh(existingToken, token);
        }
        if (global.kuzzle.config.internal.notifiableProtocols.includes(request.context.connection.protocol)) {
            // Link the connection with the token, this way the connection can be notified when the token has expired.
            global.kuzzle.tokenManager.link(token, request.context.connection.id);
        }
        return this._sendToken(token, request);
    }
    /**
     * Returns the user identified by the given jwt token
     *
     * @param {KuzzleRequest} request
     * @returns {Promise<Object>}
     */
    getCurrentUser(request) {
        const userId = request.context.token.userId, formattedUser = formatProcessing_1.default.serializeUser(request.context.user), promises = [];
        if (this.anonymousId === userId) {
            promises.push(bluebird_1.default.resolve([]));
        }
        else {
            for (const strategy of global.kuzzle.pluginsManager.listStrategies()) {
                const existsMethod = global.kuzzle.pluginsManager.getStrategyMethod(strategy, "exists");
                promises.push(existsMethod(request, userId, strategy)
                    .then((exists) => (exists ? strategy : null))
                    .catch((err) => wrapPluginError(err)));
            }
        }
        return bluebird_1.default.all(promises).then((strategies) => {
            if (strategies.length > 0) {
                formattedUser.strategies = strategies.filter((item) => item !== null);
            }
            return formattedUser;
        });
    }
    /**
     * Returns the rights of the user identified by the given jwt token
     *
     * @param {KuzzleRequest} request
     * @returns {Promise<object>}
     */
    getMyRights(request) {
        return request.context.user
            .getRights(global.kuzzle)
            .then((rights) => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
            .then((rights) => ({ hits: rights, total: rights.length }));
    }
    /**
     * Checks the validity of a token.
     *
     * @param {KuzzleRequest} request
     * @returns {Promise<object>}
     */
    async checkToken(request) {
        let token = "";
        if (global.kuzzle.config.http.cookieAuthentication &&
            request.getBoolean("cookieAuth")) {
            token = request.input.jwt;
        }
        else {
            token = request.getBodyString("token", "") || null;
        }
        try {
            const { expiresAt = -1, userId } = await this.ask("core:security:token:verify", token);
            return { expiresAt, kuid: userId, valid: true };
        }
        catch (error) {
            if (error.status === 401) {
                return { state: error.message, valid: false };
            }
            throw error;
        }
    }
    /**
     * Updates the current user if it is not anonymous
     *
     * @param {KuzzleRequest} request
     * @returns {Promise<object>}
     */
    async updateSelf(request) {
        this.assertIsAuthenticated(request);
        this.assertBodyHasNotAttributes(request, "_id", "profileIds");
        const userId = request.getKuid();
        const body = request.getBody();
        const user = await this.ask("core:security:user:update", userId, null, body, {
            refresh: request.getRefresh("wait_for"),
            retryOnConflict: request.getInteger("retryOnConflict", 10),
            userId,
        });
        global.kuzzle.log.info(`[SECURITY] ${securityController_1.default.userOrSdk(userId)} applied action "${request.input.action}" on user "${userId}."`);
        return formatProcessing_1.default.serializeUser(user);
    }
    /**
     * List authentication strategies
     *
     * @returns {Promise.<string[]>}
     */
    getStrategies() {
        return bluebird_1.default.resolve(global.kuzzle.pluginsManager.listStrategies());
    }
    /**
     * @param {KuzzleRequest} request
     * @returns {Promise.<Object>}
     */
    createMyCredentials(request) {
        this.assertIsAuthenticated(request);
        const userId = request.getKuid(), strategy = request.getString("strategy"), credentials = request.getBody();
        this.assertIsStrategyRegistered(strategy);
        const createMethod = global.kuzzle.pluginsManager.getStrategyMethod(strategy, "create"), validateMethod = global.kuzzle.pluginsManager.getStrategyMethod(strategy, "validate");
        return validateMethod(request, credentials, userId, strategy, false)
            .then(() => createMethod(request, credentials, userId, strategy))
            .catch((err) => wrapPluginError(err));
    }
    /**
     * @param {KuzzleRequest} request
     * @returns {Promise.<Object>}
     */
    updateMyCredentials(request) {
        this.assertIsAuthenticated(request);
        const userId = request.getKuid(), strategy = request.getString("strategy"), credentials = request.getBody();
        this.assertIsStrategyRegistered(strategy);
        const updateMethod = global.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, "update"), validateMethod = global.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, "validate");
        return validateMethod(request, credentials, userId, strategy, true)
            .then(() => updateMethod(request, credentials, userId, strategy))
            .catch((err) => wrapPluginError(err));
    }
    /**
     * @param {KuzzleRequest} request
     * @returns {Promise.<Object>}
     */
    credentialsExist(request) {
        this.assertIsAuthenticated(request);
        const userId = request.getKuid(), strategy = request.getString("strategy");
        this.assertIsStrategyRegistered(strategy);
        const existsMethod = global.kuzzle.pluginsManager.getStrategyMethod(strategy, "exists");
        return existsMethod(request, userId, strategy).catch((err) => wrapPluginError(err));
    }
    /**
     * @param {KuzzleRequest} request
     * @returns {Promise.<Object>}
     */
    validateMyCredentials(request) {
        this.assertIsAuthenticated(request);
        const userId = request.getKuid(), strategy = request.getString("strategy"), credentials = request.getBody();
        this.assertIsStrategyRegistered(strategy);
        const validateMethod = global.kuzzle.pluginsManager.getStrategyMethod(strategy, "validate");
        return validateMethod(request, credentials, userId, strategy, false).catch((err) => wrapPluginError(err));
    }
    /**
     * @param {KuzzleRequest} request
     * @returns {Promise.<Object>}
     */
    deleteMyCredentials(request) {
        this.assertIsAuthenticated(request);
        const userId = request.getKuid(), strategy = request.getString("strategy");
        this.assertIsStrategyRegistered(strategy);
        const deleteMethod = global.kuzzle.pluginsManager.getStrategyMethod(strategy, "delete");
        return deleteMethod(request, userId, strategy)
            .then(() => ({ acknowledged: true }))
            .catch((err) => wrapPluginError(err));
    }
    /**
     * @param {KuzzleRequest} request
     * @returns {Promise.<Object>}
     */
    getMyCredentials(request) {
        this.assertIsAuthenticated(request);
        const userId = request.getKuid(), strategy = request.getString("strategy");
        this.assertIsStrategyRegistered(strategy);
        if (!global.kuzzle.pluginsManager.hasStrategyMethod(strategy, "getInfo")) {
            return bluebird_1.default.resolve({});
        }
        const getInfoMethod = global.kuzzle.pluginsManager.getStrategyMethod(strategy, "getInfo");
        return getInfoMethod(request, userId, strategy).catch((err) => wrapPluginError(err));
    }
    /**
     * @param {KuzzleRequest} request
     */
    async refreshToken(request) {
        this.assertIsAuthenticated(request);
        const token = await this.ask("core:security:token:refresh", request.context.user, request.context.token, request.input.args.expiresIn);
        return this._sendToken(token, request);
    }
    assertIsAuthenticated(request) {
        if (request.context.user._id === this.anonymousId) {
            throw kerror.get("security", "rights", "unauthorized", request.input.controller, request.input.action);
        }
    }
}
exports.AuthController = AuthController;
function wrapPluginError(error) {
    if (!(error instanceof errors_1.KuzzleError)) {
        throw kerror.getFrom(error, "plugin", "runtime", "unexpected_error", error.message);
    }
    throw error;
}
module.exports = AuthController;
//# sourceMappingURL=authController.js.map