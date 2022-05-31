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

import { KuzzleRequest } from '../request';
import { NativeController } from './baseController';
import v8 from 'v8';
import Inspector from 'inspector';
import { HttpStream } from '../../types';
import * as kerror from '../../kerror';
import { RequestMonitor } from '../../core/debug/requestMonitor';
import { DebugModule } from '../../types/DebugModule';
import { JSONObject } from 'kuzzle-sdk';

const DEBUGGER_EVENT = 'kuzzle-debugger-event';

type DebugModuleMethod = (params: JSONObject) => any;

/**
 * @class DebugController
 */
export class DebugController extends NativeController {
  private inspector: Inspector.Session;

  private debuggerStatus = false;

  /**
   * Map<eventName, Set<connectionId>>
   */
  private events = new Map<string, Set<string>>();

  /**
   * Map of functions from the DebugModules
   */
  private kuzzlePostMethods = new Map<string, DebugModuleMethod>();

  /**
   * List of DebugModule for DebugController
   * Used to add new methods and events to the protocol
   */
  private modules: DebugModule[] = [
    new RequestMonitor()
  ];

  constructor () {
    super([
      'nodeVersion',
      'heapSnapshot',
      'getHeapStatistics',
      'getHeapSpaceStatistics',
      'getHeapCodeStatistics',
      'setFlags',
      'collectGarbage',
      'enable',
      'disable',
      'post',
      'addListener',
      'removeListener',
    ]);
  }

  async init () {
    super.init();

    this.inspector = new Inspector.Session();

    // Remove connection id from the list of listeners for each event
    global.kuzzle.on('connection:remove', connectionId => {
      if (! this.debuggerStatus) {
        return;
      }

      for (const listener of this.events.values()) {
        listener.delete(connectionId);
      }
    });

    this.inspector.on('inspectorNotification', async (payload) => {
      if (! this.debuggerStatus) {
        return;
      }

      await this.notifyGlobalListeners(payload.method, payload);

      const listeners = this.events.get(payload.method);
      if (! listeners) {
        return;
      }

      const promises = [];
      for (const connectionId of listeners) {
        promises.push(
          this.notifyConnection(
            connectionId,
            DEBUGGER_EVENT,
            {
              event: payload.method,
              result: payload
            }
          )
        );
      }

      // No need to catch, notify is already try-catched
      await Promise.all(promises);
    });

    for (const module of this.modules) {
      await module.init();

      for (const methodName of module.methods) {
        if (! module[methodName]) {
          throw new Error(`Missing implementation of method "${methodName}" inside DebugModule "${module.name}"`);
        }
        this.kuzzlePostMethods.set(`Kuzzle.${module.name}.${methodName}`, module[methodName].bind(module));
      }

      for (const eventName of module.events) {
        module.on(eventName, async payload => {
          const event = `Kuzzle.${module.name}.${eventName}`;
          await this.notifyGlobalListeners(event, payload);

          const listeners = this.events.get(event);
          if (! listeners) {
            return;
          }

          const promises = [];
          for (const connectionId of listeners) {
            promises.push(this.notifyConnection(connectionId, DEBUGGER_EVENT, {
              event,
              result: payload
            }));
          }

          // No need to catch, notify is already try-catched
          await Promise.all(promises);
        });
      }
    }
  }

  async nodeVersion () {
    return process.version;
  }

  /**
   * Take a heap snapshot and returns the filename of the snapshot.
   * If the download parameter is set to true, the snapshot will be downloaded using an HTTP Stream instead of saved on the disk.
   * 
   * @param {Request} request
   */
  async heapSnapshot (request: KuzzleRequest) {
    if (request.context.connection.protocol !== 'http') {
      throw kerror.get('api', 'assert', 'unsupported_protocol', request.context.connection.protocol, 'debug:heapSnapshot');
    }

    const stream = v8.getHeapSnapshot();

    const date = new Date();
    const filename = `heap-${date.getFullYear()}-${date.getMonth()}-${date.getDay()}-${date.getHours()}-${date.getMinutes()}.heapsnapshot`;
    request.response.configure({
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/json',
      }
    });

    return new HttpStream(stream);
  }

  /**
   * See https://nodejs.org/dist/latest-v16.x/docs/api/v8.html#v8getheapstatistics
   * 
   * @returns {Promise}
   */
  async getHeapStatistics () {
    return v8.getHeapStatistics();
  }

  /**
   * Returns statistics about the V8 heap spaces, i.e. the segments which make up the V8 heap.
   * See https://nodejs.org/dist/latest-v16.x/docs/api/v8.html#v8getheapspacestatistics
   * 
   * @returns {Promise}
   */
  async getHeapSpaceStatistics () {
    return v8.getHeapSpaceStatistics();
  }


  /**
   * See https://nodejs.org/dist/latest-v16.x/docs/api/v8.html#v8getheapcodestatistics
   */
  async getHeapCodeStatistics () {
    return v8.getHeapCodeStatistics();
  }

  /**
   * The v8.setFlagsFromString() method can be used to programmatically set V8 command-line flags. This method should be used with care. Changing settings after the VM has started may result in unpredictable behavior, including crashes and data loss; or it may simply do nothing.
   * See https://nodejs.org/dist/latest-v16.x/docs/api/v8.html#v8setflagsfromstringflags
   */
  async setFlags (request: KuzzleRequest) {
    const flags = request.getString('flags');

    return v8.setFlagsFromString(flags);
  }

  async collectGarbage () {
    return await this.inspectorPost('HeapProfiler.collectGarbage', {});
  }

  /**
   * Connect the debugger
   */
  async enable () {
    if (this.debuggerStatus) {
      return;
    }

    this.inspector.connect();
    this.debuggerStatus = true;
  }

  /**
   * Disconnect the debugger and clears all the events listeners
   */
  async disable () {
    if (! this.debuggerStatus) {
      return;
    }

    this.inspector.disconnect();
    this.debuggerStatus = false;
    this.events.clear();
  }

  /**
   * Trigger action from debugger directly following the Chrome Debug Protocol
   * See: https://chromedevtools.github.io/devtools-protocol/v8/
   */
  async post (request: KuzzleRequest) {
    const method = request.getBodyString('method');
    const params = request.getBodyObject('params', {});

    const debugModuleMethod = this.kuzzlePostMethods.get(method);

    if (debugModuleMethod) {
      return await debugModuleMethod(params);
    }

    return await this.inspectorPost(method, params);
  }

  /**
   * Make the websocket connection listen and receive events from Chrome Debug Protocol
   * See events from: https://chromedevtools.github.io/devtools-protocol/v8/
   */
  async addListener (request: KuzzleRequest) {
    if (request.context.connection.protocol !== 'websocket') {
      throw kerror.get('api', 'assert', 'unsupported_protocol', request.context.connection.protocol, 'debug:addListener');
    }

    if (! this.debuggerStatus) {
      throw kerror.get('core', 'debugger', 'not_enabled');
    }

    const event = request.getBodyString('event');

    let listeners = this.events.get(event);
    if (! listeners) {
      listeners = new Set();
      this.events.set(event, listeners);
    }

    listeners.add(request.context.connection.id);
  }

  /**
   * Remove the websocket connection from the events' listeners
   */
  async removeListener (request: KuzzleRequest) {
    if (request.context.connection.protocol !== 'websocket') {
      throw kerror.get('api', 'assert', 'unsupported_protocol', request.context.connection.protocol, 'debug:removeListener');
    }

    if (! this.debuggerStatus) {
      throw kerror.get('core', 'debugger', 'not_enabled');
    }

    const event = request.getBodyString('event');

    const listeners = this.events.get(event);

    if (listeners) {
      listeners.delete(request.context.connection.id);
    }
  }

  /**
   * Execute a method using the Chrome Debug Protocol
   * @param method Chrome Debug Protocol method to execute
   * @param params 
   * @returns 
   */
  private async inspectorPost (method: string, params: JSONObject) {
    if (! this.debuggerStatus) {
      throw kerror.get('core', 'debugger', 'not_enabled');
    }

    let resolve, error;

    const promise = new Promise((res, rej) => {
      resolve = res;
      error = rej;
    });

    this.inspector.post(method, params, (err, res) => {
      if (err) {
        error(err);
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
  private async notifyConnection (connectionId: string, event: string, payload: JSONObject) {
    global.kuzzle.entryPoint._notify({
      channels: [event],
      connectionId: connectionId,
      payload: payload,
    });
  }

  private async notifyGlobalListeners (event: string, payload: JSONObject) {
    const listeners = this.events.get('*');

    if (! listeners) {
      return;
    }

    const promises = [];
    for (const connectionId of listeners) {
      promises.push(this.notifyConnection (connectionId, DEBUGGER_EVENT, {
        event,
        result: payload
      }));
    }

    // No need to catch, notify is already try-catched
    await Promise.all(promises);
  }
}
