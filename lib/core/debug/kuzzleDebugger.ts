import Inspector from "inspector";
import * as kerror from "../../kerror";
import { JSONObject } from "kuzzle-sdk";
import get from "lodash/get";
import HttpWsProtocol from "../../core/network/protocols/httpwsProtocol";

const DEBUGGER_EVENT = "kuzzle-debugger-event";

export class KuzzleDebugger {
  private inspector: Inspector.Session;

  private debuggerStatus = false;

  /**
   * Map<eventName, Set<connectionId>>
   */
  private events = new Map<string, Set<string>>();

  private httpWsProtocol?: HttpWsProtocol;

  async init() {
    this.httpWsProtocol = global.kuzzle.entryPoint.protocols.get('websocket');

    this.inspector = new Inspector.Session();

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
        promises.push(
          this.notifyConnection(connectionId, DEBUGGER_EVENT, {
            event: payload.method,
            result: payload,
          })
        );
      }

      // No need to catch, notify is already try-catched
      await Promise.all(promises);
    });

    await this.registerAsks();
  }

  async registerAsks() {
    global.kuzzle.onAsk("core:debugger:enable", () => this.enable());
    global.kuzzle.onAsk("core:debugger:disable", () => this.disable());
    global.kuzzle.onAsk("core:debugger:post", (method, params) =>
      this.post(method, params)
    );
    global.kuzzle.onAsk("core:debugger:isEnabled", () => this.debuggerStatus);
    global.kuzzle.onAsk("core:debugger:removeListener", (event, connectionId) =>
      this.removeListener(event, connectionId)
    );
    global.kuzzle.onAsk("core:debugger:addListener", (event, connectionId) =>
      this.addListener(event, connectionId)
    );
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
    await global.kuzzle.ask("cluster:node:preventEviction", true);
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
    await global.kuzzle.ask("cluster:node:preventEviction", false);
    this.events.clear();
  }

  /**
   * Trigger action from debugger directly following the Chrome Debug Protocol
   * See: https://chromedevtools.github.io/devtools-protocol/v8/
   */
  async post(method: string, params: JSONObject = {}) {
    if (!this.debuggerStatus) {
      throw kerror.get("core", "debugger", "not_enabled");
    }

    if (!get(global.kuzzle.config, "security.debug.native_debug_protocol")) {
      throw kerror.get(
        "core",
        "debugger",
        "native_debug_protocol_usage_denied"
      );
    }

    // Always disable report progress because this parameter causes a segfault.
    // The reason this happens is because the inspector is running inside the same thread
    // as the Kuzzle Process and reportProgress forces the inspector to call function in the JS Heap
    // while it is being inspected by the HeapProfiler, which causes a segfault.
    // See: https://github.com/nodejs/node/issues/44634
    if (params.reportProgress) {
      // We need to send a fake HeapProfiler.reportHeapSnapshotProgress event
      // to the inspector to make Chrome think that the HeapProfiler is done
      // otherwise, even though the Chrome Inspector did receive the whole snapshot, it will not be parsed.
      //
      // Chrome inspector is waiting for a HeapProfiler.reportHeapSnapshotProgress event with the finished property set to true
      // The `done` and `total` properties are only used to show a progress bar, so there are not important.
      // Sending this event before the HeapProfiler.addHeapSnapshotChunk event will not cause any problem,
      // in fact, Chrome always do that when taking a snapshot, it receives the HeapProfiler.reportHeapSnapshotProgress event
      // before the HeapProfiler.addHeapSnapshotChunk event.
      // So this will have no impact and when receiving the HeapProfiler.addHeapSnapshotChunk event, Chrome will wait to receive
      // a complete snapshot before parsing it if it has received the HeapProfiler.reportHeapSnapshotProgress event with the finished property set to true before.
      this.inspector.emit('inspectorNotification', {
        method: 'HeapProfiler.reportHeapSnapshotProgress',
        params: {
          done: 0,
          total: 0,
          finished: true,
        },
      });
      params.reportProgress = false;
    }

    return this.inspectorPost(method, params);
  }

  /**
   * Make the websocket connection listen and receive events from Chrome Debug Protocol
   * See events from: https://chromedevtools.github.io/devtools-protocol/v8/
   */
  async addListener(event: string, connectionId: string) {
    if (!this.debuggerStatus) {
      throw kerror.get("core", "debugger", "not_enabled");
    }

    if (this.httpWsProtocol) {
      const socket = this.httpWsProtocol.socketByConnectionId.get(connectionId);
      if (socket) {
        /**
         * Mark the socket as a debugging socket
         * this will bypass some limitations like the max pressure buffer size,
         * which could end the connection when the debugger is sending a lot of data.
         */
        socket.debugSession = true;
      }
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
  async removeListener(event: string, connectionId: string) {
    if (!this.debuggerStatus) {
      throw kerror.get("core", "debugger", "not_enabled");
    }

    const listeners = this.events.get(event);

    if (listeners) {
      listeners.delete(connectionId);
    }

    if (this.httpWsProtocol) {
      const socket = this.httpWsProtocol.socketByConnectionId.get(connectionId);
      if (socket) {

        let removeDebugSessionMarker = true;
        /**
         * If the connection doesn't listen to any other events
         * we can remove the debugSession marker
         */
        for (const event of this.events.keys()) {
          const listeners = this.events.get(event);
          if (listeners && listeners.has(connectionId)) {
            removeDebugSessionMarker = false;
            break;
          }
        }

        if (removeDebugSessionMarker) {
          socket.debugSession = false;
        }
      }
    }
  }

  /**
   * Execute a method using the Chrome Debug Protocol
   * @param method Chrome Debug Protocol method to execute
   * @param params
   * @returns
   */
  private async inspectorPost(
    method: string,
    params: JSONObject
  ): Promise<JSONObject> {
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
      } else {
        resolve(res);
      }
    });

    return promise;
  }

  /**
   * Sends a direct notification to a websocket connection without having to listen to a specific room
   */
  private async notifyConnection(
    connectionId: string,
    event: string,
    payload: JSONObject
  ) {
    global.kuzzle.entryPoint._notify({
      channels: [event],
      connectionId,
      payload,
    });
  }

  private async notifyGlobalListeners(event: string, payload: JSONObject) {
    const listeners = this.events.get("*");

    if (!listeners) {
      return;
    }

    const promises = [];
    for (const connectionId of listeners) {
      promises.push(
        this.notifyConnection(connectionId, DEBUGGER_EVENT, {
          event,
          result: payload,
        })
      );
    }

    // No need to catch, notify is already try-catched
    await Promise.all(promises);
  }
}
