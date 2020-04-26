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

const EventEmitter = require('eventemitter3');
const _ = require('lodash');
const debug = require('debug')('kuzzle:events');
const Promback = require('../../util/promback');
const errorsManager = require('../../util/errors');
const PipeRunner = require('./pipeRunner');

const runtimeError = errorsManager.wrap('plugin', 'runtime');

/**
 * We declare the callback used by Kuzzle.pipe one time instead
 * of redeclaring a closure each time we want to run the pipes.
 *
 * The context of this callback must be bound to this following object:
 * { instance: (kuzzle instance), promback, events }
 */
/* eslint-disable no-invalid-this */
function pipeCallback (error, updated) {
  if (error) {
    this.promback.reject(error);
    return;
  }

  for (let i = 0; i < this.events.length; i++) {
    this.instance.superEmit(this.events[i], updated);
  }

  this.promback.resolve(updated);
}
/* eslint-enable no-invalid-this */

/**
 * For a specific event, returns the event and all its wildcarded versions
 * @example
 *  getWildcardEvents('data:create') // return ['data:create', 'data:*']
 *  getWildcardEvents('data:beforeCreate') // return ['data:beforeCreate',
 *                                         //         'data:*', 'data:before*']
 * @param {String} event
 * @returns {Array<String>} wildcard events
 */
const getWildcardEvents = _.memoize(event => {
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
    this.pipes = new Map();
    this.pluginPipeRunner = new PipeRunner(maxConcurrentPipes, pipesBufferSize);
  }

  /**
   * Emits an event and all its wildcarded versions
   *
   * @warning Critical code section
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
   * @warning Critical code section
   *
   * @param  {string} event
   * @param  {*} data
   * @return {Promise.<*>|null}
   */
  pipe (event, ...data) {
    debug('Triggering pipe "%s" with data: %o', event, data);

    const events = getWildcardEvents(event);
    let callback = null;

    // safe: a pipe's payload can never contain functions
    if (typeof data[data.length-1] === 'function') {
      callback = data.pop();
    }

    const promback = new Promback(callback);

    // Create a context for the emitPluginPipe callback
    const callbackContext = {
      events,
      instance: this,
      promback
    };

    this.emitPluginPipe(events, data, pipeCallback, callbackContext);

    return promback.deferred;
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
    if (!this.pipes.has(event)) {
      this.pipes.set(event, []);
    }

    this.pipes.get(event).push(fn);
  }

  /**
   * Emit a "pipe" event for plugins, returning a promise resolved once all
   * registered pipe listeners have finished processing the provided data.
   *
   * Each listener has to resolve its promise with an updated version of the
   * provided data, which is then passed to the next listener, and so on in
   * series until the last listener resolves.
   *
   * @warning Critical code section
   *  - pipes can be triggered thousand of time per second
   *
   * @param  {Array.<string>} events
   * @param  {Array.<*>} payload
   * @param  {Function} callback
   * @param  {Object} callbackContext
   */
  emitPluginPipe (events, payload, callback, callbackContext) {
    const funcs = [];

    for (let i = 0; i < events.length; i++) {
      const targets = this.pipes.get(events[i]);

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
