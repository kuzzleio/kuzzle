import Inspector from "inspector";
import * as kerror from "../../kerror";
import { DebugModule } from "../../types/DebugModule";
import { JSONObject } from "kuzzle-sdk";
import get from "lodash/get";
import { ClusterDebugModule } from "./modules/clusterDebugModule";
import { RequestMonitor } from "./modules/requestMonitor";

const DEBUGGER_EVENT = "kuzzle-debugger-event";

type DebugModuleMethod = (params: JSONObject) => any;

export class KuzzleDebugger {
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
    new ClusterDebugModule(),
    new RequestMonitor(),
  ];

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

    for (const module of this.modules) {
      await module.init(this.inspector);

      for (const methodName of module.methods) {
        if (!module[methodName]) {
          throw new Error(
            `Missing implementation of method "${methodName}" inside DebugModule "${module.name}"`
          );
        }
        this.kuzzlePostMethods.set(
          `Kuzzle.${module.name}.${methodName}`,
          module[methodName].bind(module)
        );
      }

      for (const eventName of module.events) {
        module.on(eventName, async (payload) => {
          if (!this.debuggerStatus) {
            return;
          }

          const event = `Kuzzle.${module.name}.${eventName}`;
          await this.notifyGlobalListeners(event, payload);

          const listeners = this.events.get(event);
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
        });
      }
    }
  }

  /**
   * Disconnect the debugger and clears all the events listeners
   */
  async disable() {
    if (!this.debuggerStatus) {
      return;
    }

    for (const module of this.modules) {
      for (const eventName of module.events) {
        module.removeAllListeners(eventName);
      }
      await module.cleanup();
    }

    this.inspector.disconnect();
    this.debuggerStatus = false;
    this.events.clear();
    this.kuzzlePostMethods.clear();
  }

  /**
   * Trigger action from debugger directly following the Chrome Debug Protocol
   * See: https://chromedevtools.github.io/devtools-protocol/v8/
   */
  async post(method: string, params: JSONObject = {}) {
    if (!this.debuggerStatus) {
      throw kerror.get("core", "debugger", "not_enabled");
    }

    if (method.startsWith("Kuzzle.")) {
      const debugModuleMethod = this.kuzzlePostMethods.get(method);

      if (debugModuleMethod) {
        return debugModuleMethod(params);
      }
      throw kerror.get("core", "debugger", "method_not_found", method);
    }

    if (!get(global.kuzzle.config, "security.debug.native_debug_protocol")) {
      throw kerror.get(
        "core",
        "debugger",
        "native_debug_protocol_usage_denied"
      );
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
