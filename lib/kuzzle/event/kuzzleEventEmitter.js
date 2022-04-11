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

'use strict';

// Most of the functions exposed in this file should be viewed as
// critical section of code.

const assert = require('assert');

const EventEmitter = require('eventemitter3');
const Bluebird = require('bluebird');
const debug = require('debug')('kuzzle:events');
const { v4: uuidv4 } = require('uuid');

const Promback = require('../../util/promback');
const memoize = require('../../util/memoize');
const PipeRunner = require('./pipeRunner');
const kerror = require('../../kerror');

class PluginPipeDefinition {
  constructor (event, handler, pipeId = null) {
    this.event = event;
    this.handler = handler;

    this.pipeId = pipeId || uuidv4();
  }
}

class KuzzleEventEmitter extends EventEmitter {
  constructor (maxConcurrentPipes, pipesBufferSize) {
    super();
    this.superEmit = super.emit;
    this.pipeRunner = new PipeRunner(maxConcurrentPipes, pipesBufferSize);

    /**
     * Map of plugin pipe handler functions by event
     *
     * @type Map<string, Function[]>
     */
    this.pluginPipes = new Map();

    /**
     * Map of plugin pipe definitions by pipeId
     *
     * @type Map<string, PluginPipeDefinition>
     */
    this.pluginPipeDefinitions = new Map();

    this.corePipes = new Map();
    this.coreAnswerers = new Map();
    this.coreSyncedAnswerers = new Map();
  }

  /**
   * Registers a core method on a pipe
   * Note: core methods cannot listen to wildcarded events, only exact matching
   * works here.
   *
   * @param  {String}   event
   * @param  {Function} fn
   */
  onPipe (event, fn) {
    assert(typeof fn === 'function', `Cannot listen to pipe event ${event}: "${fn}" is not a function`);

    if (! this.corePipes.has(event)) {
      this.corePipes.set(event, []);
    }

    this.corePipes.get(event).push(fn);
  }

  /**
   * Registers a core 'ask' event answerer
   * There can only be 0 or 1 answerer per ask event.
   *
   * @param  {String}   event
   * @param  {Function} fn
   */
  onAsk (event, fn) {
    assert(typeof fn === 'function', `Cannot listen to ask event "${event}": "${fn}" is not a function`);
    assert(! this.coreAnswerers.has(event), `Cannot add a listener to the ask event "${event}": event has already an answerer`);

    this.coreAnswerers.set(event, fn);
  }

  
  /**
   * Registers a core 'callback' answerer
   * There can only be 0 or 1 answerer per callback event.
   *
   * @param  {String}   event
   * @param  {Function} fn
   */
  onCall (event, fn) {
    assert(typeof fn === 'function', `Cannot register callback for event "${event}": "${fn}" is not a function`);
    assert(! this.coreSyncedAnswerers.has(event), `Cannot register callback for event "${event}": a callback has already been registered`);

    this.coreSyncedAnswerers.set(event, fn);
  }

  /**
   * Emits an event and all its wildcarded versions
   *
   * @warning Critical section of code
   *
   * @param  {string} event
   * @param  {*} data
   */
  emit (event, data) {
    const events = getWildcardEvents(event);
    debug('Triggering event "%s" with data: %o', event, data);

    for (let i = 0; i < events.length; i++) {
      super.emit(events[i], data);
    }
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
   *
   * @param  {string} event
   * @param  {*} payload
   * @returns {Promise.<*>|null}
   */
  pipe (event, ...payload) {
    debug('Triggering pipe "%s" with payload: %o', event, payload);

    let callback = null;

    // safe: a pipe's payload can never contain functions
    if (payload.length > 0 && typeof payload[payload.length - 1] === 'function') {
      callback = payload.pop();
    }

    const events = getWildcardEvents(event);
    const funcs = [];

    for (let i = 0; i < events.length; i++) {
      const targets = this.pluginPipes.get(events[i]);

      if (targets) {
        targets.forEach(t => funcs.push(t));
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
    }
    else {
      this.pipeRunner.run(funcs, payload, pipeCallback, callbackContext);
    }

    return promback.deferred;
  }

  /**
   * Emits an "ask" event to get information about the provided payload
   */
  async ask (event, ...payload) {
    debug('Triggering ask "%s" with payload: %o', event, payload);

    const fn = this.coreAnswerers.get(event);

    if (! fn) {
      throw kerror.get('core', 'fatal', 'assertion_failed', `the requested ask event '${event}' doesn't have an answerer`);
    }

    const response = await fn(...payload);

    getWildcardEvents(event).forEach(ev => super.emit(ev, {
      args: payload,
      response,
    }));

    return response;
  }

  /**
   * Calls a callback to get information about the provided payload
   */
  call (event, ...payload) {
    debug('Triggering callback "%s" with payload: %o', event, payload);

    const fn = this.coreSyncedAnswerers.get(event);

    if (! fn) {
      throw kerror.get('core', 'fatal', 'assertion_failed', `the requested callback event '${event}' doesn't have an answerer`);
    }

    const response = fn(...payload);

    getWildcardEvents(event).forEach(ev => super.emit(ev, {
      args: payload,
      response,
    }));

    return response;
  }

  /**
   * Registers a plugin hook.
   * Catch any error in the handler and emit the hook:onError event.
   */
  registerPluginHook (pluginName, event, fn) {
    this.on(event, (...args) => {
      try {
        const ret = fn(...args, event);

        if (typeof ret === 'object' && typeof ret.catch === 'function') {
          ret.catch(error => {
            if (event !== 'hook:onError') {
              this.emit('hook:onError', { error, event, pluginName });
            }
            else {
              this.emit('plugin:hook:loop-error', { error, pluginName });
            }
          });
        }
      }
      catch (error) {
        if (event !== 'hook:onError') {
          this.emit('hook:onError', { error, event, pluginName });
        }
        else {
          this.emit('plugin:hook:loop-error', { error, pluginName });
        }
      }
    });
  }

  registerPluginPipe (event, handler) {
    if (! this.pluginPipes.has(event)) {
      this.pluginPipes.set(event, []);
    }

    this.pluginPipes.get(event).push(handler);

    const definition = new PluginPipeDefinition(event, handler);

    this.pluginPipeDefinitions.set(definition.pipeId, definition);

    return definition.pipeId;
  }

  unregisterPluginPipe (pipeId) {
    const definition = this.pluginPipeDefinitions.get(pipeId);

    if (! definition) {
      throw kerror.get('plugin', 'runtime', 'unknown_pipe', pipeId);
    }

    const handlers = this.pluginPipes.get(definition.event);
    handlers.splice(handlers.indexOf(definition.handler), 1);
    if (handlers.length > 0) {
      this.pluginPipes.set(definition.event, handlers);
    }
    else {
      this.pluginPipes.delete(definition.event);
    }

    this.pluginPipeDefinitions.delete(pipeId);
  }

  /**
   * Checks if an ask event has an answerer
   *
   * @param  {string}  event
   * @return {Boolean}       [description]
   */
  hasAskAnswerer (event) {
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
async function pipeCallback (error, ...updated) {
  /* eslint-disable no-invalid-this */
  if (error) {
    this.promback.reject(error);
    return;
  }

  const corePipes = this.instance.corePipes.get(this.targetEvent);

  if (corePipes) {
    await Bluebird.map(corePipes, fn => fn(...updated));
  }

  for (let i = 0; i < this.events.length; i++) {
    this.instance.superEmit(this.events[i], ...updated);
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
 *
 * @param {String} event
 * @returns {Array<String>} wildcard events
 */
const getWildcardEvents = memoize(event => {
  const events = [event];
  const delimIndex = event.lastIndexOf(':');

  if (delimIndex === -1) {
    return events;
  }

  const scope = event.slice(0, delimIndex);
  const name = event.slice(delimIndex + 1);

  ['before', 'after'].forEach(prefix => {
    if (name.startsWith(prefix)) {
      events.push(`${scope}:${prefix}*`);
    }
  });

  events.push(`${scope}:*`);

  return events;
});

module.exports = KuzzleEventEmitter;
