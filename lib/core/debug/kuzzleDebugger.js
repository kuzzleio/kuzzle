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
exports.KuzzleDebugger = void 0;
const inspector_1 = __importDefault(require("inspector"));
const kerror = __importStar(require("../../kerror"));
const get_1 = __importDefault(require("lodash/get"));
const DEBUGGER_EVENT = "kuzzle-debugger-event";
class KuzzleDebugger {
    constructor() {
        this.debuggerStatus = false;
        /**
         * Map<eventName, Set<connectionId>>
         */
        this.events = new Map();
    }
    async init() {
        this.inspector = new inspector_1.default.Session();
        // Remove connection id from the list of listeners for each event
        global.kuzzle.on("connection:remove", (connectionId) => {
            if (!this.debuggerStatus) {
                return;
            }
            for (const listener of this.events.values()) {
                listener.delete(connectionId);
            }
        });
        this.inspector.on("inspectorNotification", async (payload) => {
            if (!this.debuggerStatus) {
                return;
            }
            await this.notifyGlobalListeners(payload.method, payload);
            const listeners = this.events.get(payload.method);
            if (!listeners) {
                return;
            }
            const promises = [];
            for (const connectionId of listeners) {
                promises.push(this.notifyConnection(connectionId, DEBUGGER_EVENT, {
                    event: payload.method,
                    result: payload,
                }));
            }
            // No need to catch, notify is already try-catched
            await Promise.all(promises);
        });
        await this.registerAsks();
    }
    async registerAsks() {
        global.kuzzle.onAsk("core:debugger:enable", () => this.enable());
        global.kuzzle.onAsk("core:debugger:disable", () => this.disable());
        global.kuzzle.onAsk("core:debugger:post", (method, params) => this.post(method, params));
        global.kuzzle.onAsk("core:debugger:isEnabled", () => this.debuggerStatus);
        global.kuzzle.onAsk("core:debugger:removeListener", (event, connectionId) => this.removeListener(event, connectionId));
        global.kuzzle.onAsk("core:debugger:addListener", (event, connectionId) => this.addListener(event, connectionId));
    }
    /**
     * Connect the debugger
     */
    async enable() {
        if (this.debuggerStatus) {
            return;
        }
        this.inspector.connect();
        this.debuggerStatus = true;
        global.kuzzle.ask("cluster:node:preventEviction", true);
    }
    /**
     * Disconnect the debugger and clears all the events listeners
     */
    async disable() {
        if (!this.debuggerStatus) {
            return;
        }
        this.inspector.disconnect();
        this.debuggerStatus = false;
        global.kuzzle.ask("cluster:node:preventEviction", false);
        this.events.clear();
    }
    /**
     * Trigger action from debugger directly following the Chrome Debug Protocol
     * See: https://chromedevtools.github.io/devtools-protocol/v8/
     */
    async post(method, params = {}) {
        if (!this.debuggerStatus) {
            throw kerror.get("core", "debugger", "not_enabled");
        }
        if (!(0, get_1.default)(global.kuzzle.config, "security.debug.native_debug_protocol")) {
            throw kerror.get("core", "debugger", "native_debug_protocol_usage_denied");
        }
        return this.inspectorPost(method, params);
    }
    /**
     * Make the websocket connection listen and receive events from Chrome Debug Protocol
     * See events from: https://chromedevtools.github.io/devtools-protocol/v8/
     */
    async addListener(event, connectionId) {
        if (!this.debuggerStatus) {
            throw kerror.get("core", "debugger", "not_enabled");
        }
        let listeners = this.events.get(event);
        if (!listeners) {
            listeners = new Set();
            this.events.set(event, listeners);
        }
        listeners.add(connectionId);
    }
    /**
     * Remove the websocket connection from the events" listeners
     */
    async removeListener(event, connectionId) {
        if (!this.debuggerStatus) {
            throw kerror.get("core", "debugger", "not_enabled");
        }
        const listeners = this.events.get(event);
        if (listeners) {
            listeners.delete(connectionId);
        }
    }
    /**
     * Execute a method using the Chrome Debug Protocol
     * @param method Chrome Debug Protocol method to execute
     * @param params
     * @returns
     */
    async inspectorPost(method, params) {
        if (!this.debuggerStatus) {
            throw kerror.get("core", "debugger", "not_enabled");
        }
        let resolve;
        const promise = new Promise((res) => {
            resolve = res;
        });
        this.inspector.post(method, params, (err, res) => {
            if (err) {
                resolve({
                    error: JSON.stringify(Object.getOwnPropertyDescriptors(err)),
                });
            }
            else {
                resolve(res);
            }
        });
        return promise;
    }
    /**
     * Sends a direct notification to a websocket connection without having to listen to a specific room
     */
    async notifyConnection(connectionId, event, payload) {
        global.kuzzle.entryPoint._notify({
            channels: [event],
            connectionId,
            payload,
        });
    }
    async notifyGlobalListeners(event, payload) {
        const listeners = this.events.get("*");
        if (!listeners) {
            return;
        }
        const promises = [];
        for (const connectionId of listeners) {
            promises.push(this.notifyConnection(connectionId, DEBUGGER_EVENT, {
                event,
                result: payload,
            }));
        }
        // No need to catch, notify is already try-catched
        await Promise.all(promises);
    }
}
exports.KuzzleDebugger = KuzzleDebugger;
//# sourceMappingURL=kuzzleDebugger.js.map