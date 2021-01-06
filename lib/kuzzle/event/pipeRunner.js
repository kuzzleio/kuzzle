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

const assert = require('assert');
const Denque = require('denque');

const { KuzzleError } = require('../../kerror/errors');
const waterfall = require('./waterfall');

const kerror = require('../../kerror').wrap('plugin', 'runtime');

/**
 * We declare the callback used by waterfall one time instead
 * of redeclaring a closure each time we want to run the pipes.
 *
 * This callback must be called with the following object as context:
 * { instance: (pipeRunner instance), callback: (callback after pipes execution) }
 */
/* eslint-disable no-invalid-this */
function waterfallCallback (error, result) {
  this.instance.running--;

  if (!this.instance.buffer.isEmpty()) {
    setImmediate(this.instance._boundRunNext);
  }

  if (error) {
    const cbError = error instanceof KuzzleError
      ? error
      : kerror.getFrom(error, 'unexpected_error', error.message);

    this.callback.call(this.callbackContext, cbError);
  }
  else {
    this.callback.call(this.callbackContext, null, result);
  }
}
/* eslint-enable no-invalid-this */

/**
 * @private
 * @class PipeChain
 */
class PipeChain {
  constructor (chain, args, callback, callbackContext) {
    this.chain = chain;
    this.args = args;
    this.callback = callback;
    this.callbackContext = callbackContext;
  }
}

/**
 * @class PipeRunner
 * Runs pipe chains if the number of already running concurrent pipes allows it.
 * Otherwise, delays the pipe chain until a slot is freed. If the storage
 * buffer is full, rejects the provided callback and discard the pipe chain.
 *
 * @param {Number} concurrent - max number of concurrent pipes
 * @param {Number} bufferSize - max number of delayed pipe chains
 */
class PipeRunner {
  constructor (concurrent, bufferSize) {
    assert(
      typeof concurrent === 'number' && concurrent > 0,
      'Cannot instantiate pipes executor: invalid maxConcurrentPipes parameter value');
    assert(
      typeof bufferSize === 'number' && bufferSize > 0,
      'Cannot instantiate pipes executor: invalid pipesBufferSize parameter value');

    this.maxConcurrent = concurrent;
    this.running = 0;
    this.maxBufferSize = bufferSize;
    this.buffer = new Denque();

    this._boundRunNext = this._runNext.bind(this);
  }

  /**
   * @warning Critical code section
   *
   * Pipes can be run thousands of times per seconds
   * @param {Array} chain - functions chain
   * @param {Array} args  - functions arguments
   * @param {Function} callback - end-of-chain callback
   * @param {Object} callbackContext - functions/callback context
   */
  run (chain, args, callback, callbackContext) {
    if (this.running >= this.maxConcurrent) {
      if (this.buffer.length >= this.maxBufferSize) {
        callback.call(callbackContext, kerror.get('too_many_pipes'));
      }
      else {
        this.buffer.push(new PipeChain(chain, args, callback, callbackContext));
      }

      return;
    }

    this.running++;

    // Create a context for the waterfall callback
    const waterfallCallbackCtx = {
      callback,
      callbackContext,
      instance: this,
    };

    waterfall(chain, args, waterfallCallback, waterfallCallbackCtx);
  }

  _runNext () {
    if (this.buffer.isEmpty() || this.running >= this.maxConcurrent) {
      return;
    }

    const pipe = this.buffer.shift();

    this.run(pipe.chain, pipe.args, pipe.callback, pipe.callbackContext);
  }
}

module.exports = PipeRunner;
