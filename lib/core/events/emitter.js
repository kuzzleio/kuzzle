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
const debug = require('debug')('kuzzle:events');
const Promback = require('../../util/promback');
const memoize = require('../../util/memoize');
const errorsManager = require('../../util/errors');
const PipeRunner = require('./pipeRunner');

const runtimeError = errorsManager.wrap('plugin', 'runtime');

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
    await Promise.all(corePipes.map(fn => fn(...updated)));
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


class KuzzleEventEmitter extends EventEmitter {
  constructor (maxConcurrentPipes, pipesBufferSize) {
    super();
    this.superEmit = super.emit;
    this.pluginPipeRunner = new PipeRunner(maxConcurrentPipes, pipesBufferSize);

    // register caches
    this.pluginPipes = new Map();
    this.corePipes = new Map();
    this.coreAskListeners = new Map();
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

    if (!this.corePipes.has(event)) {
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
  whenAsked (event, fn) {
    assert(typeof fn === 'function', `Cannot listen to ask event ${event}: "${fn}" is not a function`);
    assert(!this.coreAskListeners.has(event), `Cannot add a listener to the ask event "${event}": event has already an answerer`);

    this.coreAskListeners.set(event, fn);
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
   * Chains all registered pipes on an event, and then emits it the regular
   * way.
   *
   * Accepts a callback argument (to be used by pipes invoked before the funnel
   * overload-protection mechanism). If a callback is provided, this method
   * doesn't return a promise.
   *
   * @warning Critical section of code
   *
   * @param  {string} event
   * @param  {*} payload
   * @return {Promise.<*>|null}
   */
  pipe (event, ...payload) {
    debug('Triggering pipe "%s" with payload: %o', event, payload);

    let callback = null;

    // safe: a pipe's payload can never contain functions
    if (typeof payload[payload.length-1] === 'function') {
      callback = payload.pop();
    }

    // Create a context for the emitPluginPipe callback
    const promback = new Promback(callback);
    const events = getWildcardEvents(event);
    const callbackContext = {
      events,
      instance: this,
      promback,
      targetEvent: event,
    };

    this.emitPluginPipe(events, payload, pipeCallback, callbackContext);

    return promback.deferred;
  }

  /**
   * Emits an "ask" event to get information about the provided payload
   */
  async ask (event, ...payload) {
    const fn = this.coreAskListeners.get(event);

    if (!fn) {
      return undefined;
    }

    return fn(...payload);
  }

  registerPluginHook (event, fn) {
    this.on(event, (...args) => {
      try {
        fn(...args, event);
      }
      catch (error) {
        throw runtimeError.getFrom(error, 'unexpected_error', error.message);
      }
    });
  }

  registerPluginPipe (event, fn) {
    if (!this.pluginPipes.has(event)) {
      this.pluginPipes.set(event, []);
    }

    this.pluginPipes.get(event).push(fn);
  }

  /**
   * Emit a "pipe" event for plugins, returning a promise resolved once all
   * registered pipe listeners have finished processing the provided data.
   *
   * Each listener has to resolve its promise with an updated version of the
   * provided data, which is then passed to the next listener, and so on in
   * series until the last listener resolves.
   *
   * @warning Critical section of code
   *
   * @param  {Array.<string>} events
   * @param  {Array.<*>} payload
   * @param  {Function} callback
   * @param  {Object} callbackContext
   */
  emitPluginPipe (events, payload, callback, callbackContext) {
    const funcs = [];

    for (let i = 0; i < events.length; i++) {
      const targets = this.pluginPipes.get(events[i]);

      if (targets) {
        funcs.push(...targets);
      }
    }

    if (funcs.length === 0) {
      callback.call(callbackContext, null, ...payload);
    }
    else {
      this.pluginPipeRunner.run(funcs, payload, callback, callbackContext);
    }
  }
}


module.exports = KuzzleEventEmitter;
