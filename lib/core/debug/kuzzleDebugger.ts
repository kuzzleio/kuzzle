import Inspector from "inspector";
import * as kerror from "../../kerror";
import { JSONObject } from "kuzzle-sdk";
import get from "lodash/get";

const DEBUGGER_EVENT = "kuzzle-debugger-event";

export class KuzzleDebugger {
  private inspector: Inspector.Session;

  private debuggerStatus = false;

  /**
   * Map<eventName, Set<connectionId>>
   */
  private events = new Map<string, Set<string>>();

  async init() {
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

    // Always disable report progress because this params causes a segfault.
    // The reason this happens is because the inspector is running inside the same thread
    // as the Kuzzle Process and reportProgress forces the inspector to send events
    // to the main thread, while it is being inspected by the HeapProfiler, which causes javascript code
    // to be executed as the HeapProfiler is running, which causes a segfault.
    params.reportProgress = false;

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
