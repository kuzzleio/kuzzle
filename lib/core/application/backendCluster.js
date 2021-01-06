"use strict";
/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackendCluster = void 0;
const kerror_1 = __importDefault(require("../../kerror"));
class BackendCluster {
    /**
     * Broadcasts an event to listeners across all registered Kuzzle nodes
     *
     * @param  {string}        event
     * @param  {JSONObject}    payload
     * @return {Promise<void>}
     */
    async broadcast(event, payload) {
        // @deprecated - to be removed with the new cluster (that event will
        // always have an answerer)
        if (!global.kuzzle.hasAskAnswerer('cluster:event:broadcast')) {
            throw kerror_1.default.get('core', 'fatal', 'assertion_failed', 'Cannot use cluster methods in a single-node environment');
        }
        await global.kuzzle.ask('cluster:event:broadcast', event, payload);
    }
    /**
     * Registers a listener to the provided event name.
     *
     * @param  {string}        event
     * @param  {Function}      listener
     * @return {Promise<void>}       [description]
     */
    async on(event, listener) {
        // @deprecated - to be removed with the new cluster (that event will
        // always have an answerer)
        if (!global.kuzzle.hasAskAnswerer('cluster:event:on')) {
            throw kerror_1.default.get('core', 'fatal', 'assertion_failed', 'Cannot use cluster methods in a single-node environment');
        }
        await global.kuzzle.ask('cluster:event:on', event, listener);
    }
    /**
     * Registers a listener to the provided event name. This listener can be
     * invoked only once, after that it will be removed from the listeners list.
     *
     * @param  {string}        event
     * @param  {Function}      listener
     * @return {Promise<void>}
     */
    async once(event, listener) {
        // @deprecated - to be removed with the new cluster (that event will
        // always have an answerer)
        if (!global.kuzzle.hasAskAnswerer('cluster:event:once')) {
            throw kerror_1.default.get('core', 'fatal', 'assertion_failed', 'Cannot use cluster methods in a single-node environment');
        }
        await global.kuzzle.ask('cluster:event:once', event, listener);
    }
    /**
     * Removes a listener from an event.
     * If multiple instances of the same listener are registered, only the first
     * one is removed.
     *
     * @param  {string}        event
     * @param  {Function}      listener
     * @return {Promise<void>}
     */
    async off(event, listener) {
        // @deprecated - to be removed with the new cluster (that event will
        // always have an answerer)
        if (!global.kuzzle.hasAskAnswerer('cluster:event:off')) {
            throw kerror_1.default.get('core', 'fatal', 'assertion_failed', 'Cannot use cluster methods in a single-node environment');
        }
        await global.kuzzle.ask('cluster:event:off', event, listener);
    }
    /**
     * Removes all listeners from an event.
     *
     * @param  {string}        event
     * @return {Promise<void>}
     */
    async removeAllListeners(event) {
        // @deprecated - to be removed with the new cluster (that event will
        // always have an answerer)
        if (!global.kuzzle.hasAskAnswerer('cluster:event:removeAllListeners')) {
            throw kerror_1.default.get('core', 'fatal', 'assertion_failed', 'Cannot use cluster methods in a single-node environment');
        }
        await global.kuzzle.ask('cluster:event:removeAllListeners', event);
    }
}
exports.BackendCluster = BackendCluster;
//# sourceMappingURL=backendCluster.js.map