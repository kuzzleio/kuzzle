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

// Most of the functions exposed in this file should be viewed as
// critical section of code.

import assert from "assert";

import Bluebird from "bluebird";
import EventEmitter from "eventemitter3";
import { v4 as uuidv4 } from "uuid";
import { default as kuzzleDebug } from "../../util/debug";

import * as kerror from "../../kerror";
import {
  AskEventDefinition,
  AskEventHandler,
  CallEventHandler,
  EventDefinition,
  HookEventHandler,
  PipeEventHandler,
} from "../../types/EventHandler";
import memoize from "../../util/memoize";
import Promback from "../../util/promback";
import PipeRunner from "./pipeRunner";

const debug = kuzzleDebug("kuzzle:events");

class PluginPipeDefinition<
  TEventDefinition extends EventDefinition = EventDefinition,
> {
  public event: TEventDefinition["name"];
  public handler: PipeEventHandler<TEventDefinition>;
  public pipeId: string | null;

  constructor(
    event: TEventDefinition["name"],
    handler: PipeEventHandler<TEventDefinition>,
    pipeId: string | null = null,
  ) {
    this.event = event;
    this.handler = handler;

    this.pipeId = pipeId || uuidv4();
  }
}

class KuzzleEventEmitter extends EventEmitter {
  private coreAnswerers: Map<string, AskEventHandler>;
  private coreSyncedAnswerers: Map<string, HookEventHandler>;
  private corePipes: Map<string, PipeEventHandler[]>;
  private pipeRunner: PipeRunner;
  private pluginPipes: Map<string, PipeEventHandler[]>;
  private pluginPipeDefinitions: Map<string, PluginPipeDefinition>;
  private superEmit: typeof EventEmitter.prototype.emit;

  constructor(maxConcurrentPipes: number, pipesBufferSize: number) {
    super();
    this.superEmit = super.emit;
    this.pipeRunner = new PipeRunner(maxConcurrentPipes, pipesBufferSize);

    /**
     * Map of plugin pipe handler functions by event
     */
    this.pluginPipes = new Map<string, PipeEventHandler[]>();

    /**
     * Map of plugin pipe definitions by pipeId
     */
    this.pluginPipeDefinitions = new Map<string, PluginPipeDefinition>();

    this.corePipes = new Map<string, PipeEventHandler[]>();
    this.coreAnswerers = new Map<string, AskEventHandler>();
    this.coreSyncedAnswerers = new Map<string, AskEventHandler>();
  }

  /**
   * Registers a core method on a pipe
   * Note: core methods cannot listen to wildcarded events, only exact matching
   * works here.
   */
  onPipe<TEventDefinition extends EventDefinition = EventDefinition>(
    event: TEventDefinition["name"],
    fn: PipeEventHandler<TEventDefinition>,
  ) {
    assert(
      typeof fn === "function",
      `Cannot listen to pipe event ${event}: "${fn}" is not a function`,
    );

    if (!this.corePipes.has(event)) {
      this.corePipes.set(event, []);
    }

    this.corePipes.get(event).push(fn);
  }

  /**
   * Registers a core 'ask' event answerer
   * There can only be 0 or 1 answerer per ask event.
   */
  onAsk<TAskEventDefinition extends AskEventDefinition = AskEventDefinition>(
    event: TAskEventDefinition["name"],
    fn: AskEventHandler<TAskEventDefinition>,
  ) {
    assert(
      typeof fn === "function",
      `Cannot listen to ask event "${event}": "${fn}" is not a function`,
    );
    assert(
      !this.coreAnswerers.has(event),
      `Cannot add a listener to the ask event "${event}": event has already an answerer`,
    );

    this.coreAnswerers.set(event, fn);
  }

  /**
   * Registers a core 'callback' answerer
   * There can only be 0 or 1 answerer per callback event.
   */
  onCall<TAskEventDefinition extends AskEventDefinition = AskEventDefinition>(
    event: TAskEventDefinition["name"],
    fn: CallEventHandler<TAskEventDefinition>,
  ) {
    assert(
      typeof fn === "function",
      `Cannot register callback for event "${event}": "${fn}" is not a function`,
    );
    assert(
      !this.coreSyncedAnswerers.has(event),
      `Cannot register callback for event "${event}": a callback has already been registered`,
    );

    this.coreSyncedAnswerers.set(event, fn);
  }

  /**
   * Emits an event and all its wildcarded versions
   *
   * @warning Critical section of code
   */
  emit(event: string | symbol, ...args: any[]): boolean {
    const events = getWildcardEvents(event);
    debug('Triggering event "%s" with data: %o', event, args);

    if (events.length === 0) {
      debug('No listeners for event "%s"', event);
      return false;
    }

    for (const element of events) {
      super.emit(element, ...args);
    }

    return true;
  }

  /**
   * Emits a pipe event, which triggers the following, in that order:
   * 1. Plugin pipes are invoked one after another (waterfall). Each plugin must
   *    resolve the pipe (with a callback or a promise) with a similar payload
   *    than the one received
   * 2. Core pipes are invoked in parallel. They are awaited for (promises-only)
   *    but their responses are neither evaluated nor used
   * 3. Hooks are invoked in parallel. They are not awaited.
   *
   * Accepts a callback argument (to be used by pipes invoked before the funnel
   * overload-protection mechanism). If a callback is provided, this method
   * doesn't return a promise.
   *
   * @warning Critical section of code
   */
  pipe<TEventDefinition extends EventDefinition = EventDefinition>(
    event: TEventDefinition["name"],
    ...payload: TEventDefinition["args"]
  ): Promise<TEventDefinition["args"][0]> | null {
    debug('Triggering pipe "%s" with payload: %o', event, payload);

    let callback = null;

    // safe: a pipe's payload can never contain functions
    if (
      payload.length > 0 &&
      typeof payload[payload.length - 1] === "function"
    ) {
      callback = payload.pop();
    }

    const events = getWildcardEvents(event);
    const funcs = [];

    for (const element of events) {
      const targets = this.pluginPipes.get(element);

      if (targets) {
        for (const t of targets) {
          funcs.push(t);
        }
      }
    }

    // Create a context for the emitPluginPipe callback
    const promback = new Promback(callback);
    const callbackContext = {
      events,
      instance: this,
      promback,
      targetEvent: event,
    };

    if (funcs.length === 0) {
      pipeCallback.call(callbackContext, null, ...payload);
    } else {
      this.pipeRunner.run(funcs, payload, pipeCallback, callbackContext);
    }

    return promback.deferred;
  }

  /**
   * Emits an "ask" event to get information about the provided payload
   */
  async ask<
    TAskEventDefinition extends AskEventDefinition = AskEventDefinition,
  >(
    event: TAskEventDefinition["name"],
    ...args: [payload?: TAskEventDefinition["payload"], ...rest: any]
  ): Promise<TAskEventDefinition["result"]> {
    debug('Triggering ask "%s" with payload: %o', event, args);

    const fn = this.coreAnswerers.get(event);

    if (!fn) {
      throw kerror.get(
        "core",
        "fatal",
        "assertion_failed",
        `the requested ask event '${event}' doesn't have an answerer`,
      );
    }

    const response = await fn(...args);

    for (const ev of getWildcardEvents(event)) {
      super.emit(ev, {
        args,
        response,
      });
    }

    return response;
  }

  /**
   * Calls a callback to get information about the provided payload
   */
  call<TAskEventDefinition extends AskEventDefinition = AskEventDefinition>(
    event: TAskEventDefinition["name"],
    ...args: [payload?: TAskEventDefinition["payload"], ...rest: any]
  ): TAskEventDefinition["result"] {
    debug('Triggering callback "%s" with payload: %o', event, args);

    const fn = this.coreSyncedAnswerers.get(event);

    if (!fn) {
      throw kerror.get(
        "core",
        "fatal",
        "assertion_failed",
        `the requested callback event '${event}' doesn't have an answerer`,
      );
    }

    const response = fn(...args);

    for (const ev of getWildcardEvents(event)) {
      super.emit(ev, {
        args,
        response,
      });
    }

    return response;
  }

  /**
   * Registers a plugin hook.
   * Catch any error in the handler and emit the hook:onError event.
   */
  registerPluginHook<
    TEventDefinition extends EventDefinition = EventDefinition,
  >(
    pluginName: string,
    event: TEventDefinition["name"],
    fn: HookEventHandler<TEventDefinition>,
  ) {
    this.on(event, (...args) => {
      try {
        const ret = fn(...args, event);

        if (typeof ret === "object" && typeof ret.catch === "function") {
          ret.catch((error) => {
            if (event !== "hook:onError") {
              this.emit("hook:onError", { error, event, pluginName });
            } else {
              this.emit("plugin:hook:loop-error", { error, pluginName });
            }
          });
        }
      } catch (error) {
        if (event !== "hook:onError") {
          this.emit("hook:onError", { error, event, pluginName });
        } else {
          this.emit("plugin:hook:loop-error", { error, pluginName });
        }
      }
    });
  }

  registerPluginPipe<
    TEventDefinition extends EventDefinition = EventDefinition,
  >(
    event: TEventDefinition["name"],
    handler: PipeEventHandler<TEventDefinition>,
  ) {
    if (!this.pluginPipes.has(event)) {
      this.pluginPipes.set(event, []);
    }

    this.pluginPipes.get(event).push(handler);

    const definition = new PluginPipeDefinition(event, handler);

    this.pluginPipeDefinitions.set(definition.pipeId, definition);

    return definition.pipeId;
  }

  unregisterPluginPipe(pipeId: string) {
    const definition = this.pluginPipeDefinitions.get(pipeId);

    if (!definition) {
      throw kerror.get("plugin", "runtime", "unknown_pipe", pipeId);
    }

    const handlers = this.pluginPipes.get(definition.event);
    handlers.splice(handlers.indexOf(definition.handler), 1);
    if (handlers.length > 0) {
      this.pluginPipes.set(definition.event, handlers);
    } else {
      this.pluginPipes.delete(definition.event);
    }

    this.pluginPipeDefinitions.delete(pipeId);
  }

  /**
   * Checks if an ask event has an answerer
   */
  hasAskAnswerer(event: string): boolean {
    return this.coreAnswerers.has(event);
  }
}

/**
 * We declare the callback used by Kuzzle.pipe one time instead
 * of redeclaring a closure each time we want to run the pipes.
 *
 * The context of this callback must be bound to this following object:
 * { instance: (kuzzle instance), promback, events }
 *
 * @warning Critical section of code
 */
async function pipeCallback(error: any, ...updated: any[]) {
  /* eslint-disable no-invalid-this */
  if (error) {
    this.promback.reject(error);
    return;
  }

  const corePipes = this.instance.corePipes.get(this.targetEvent);

  if (corePipes) {
    await Bluebird.map(corePipes, (fn: any) => fn(...updated));
  }

  for (const element of this.events) {
    this.instance.superEmit(element, ...updated);
  }

  this.promback.resolve(updated[0]);
  /* eslint-enable no-invalid-this */
}

/**
 * For a specific event, returns the event and all its wildcarded versions
 * @example
 *  getWildcardEvents('data:create') // return ['data:create', 'data:*']
 *  getWildcardEvents('data:beforeCreate') // return ['data:beforeCreate',
 *                                         //         'data:*', 'data:before*']
 *
 * @warning Critical section of code
 */
const getWildcardEvents = memoize((event: string): string[] => {
  const events = [event];
  const delimIndex = event.lastIndexOf(":");

  if (delimIndex === -1) {
    return events;
  }

  const scope = event.slice(0, delimIndex);
  const name = event.slice(delimIndex + 1);

  for (const prefix of ["before", "after"]) {
    if (name.startsWith(prefix)) {
      events.push(`${scope}:${prefix}*`);
    }
  }

  events.push(`${scope}:*`);

  return events;
});

export default KuzzleEventEmitter;
