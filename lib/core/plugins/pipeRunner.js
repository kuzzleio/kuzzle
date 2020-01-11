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

const
  assert = require('assert'),
  Denque = require('denque'),
  async = require('async'),
  {errors: {KuzzleError}} = require('kuzzle-common-objects'),
  errorsManager = require('../../util/errors').wrap('plugin', 'runtime');

/**
 * We declare the callback used by async.waterfall one time instead
 * of redeclaring a closure each time we want to run the pipes.
 *
 * The context of this callback must be bound to this following object:
 * { instance: (pipeRunner instance), callback: (callback after pipes execution) }
 */
function waterfallCallback (error, result) {
  this.instance.running--;

  if (!this.instance.buffer.isEmpty()) {
    setImmediate(this.instance._runNext.bind(this));
  }

  if (error) {
    this.callback(error instanceof KuzzleError
      ? error
      : errorsManager.getFrom(error, 'unexpected_error', error.message));
  }
  else {
    this.callback(null, result);
  }
}

/**
 * @private
 * @class PipeChain
 */
class PipeChain {
  constructor (chain, callback) {
    this.chain = chain;
    this.callback = callback;
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
    assert(typeof concurrent === 'number' && concurrent > 0, 'Cannot instantiate pipes executor: invalid maxConcurrentPipes parameter value');
    assert(typeof bufferSize === 'number' && bufferSize > 0, 'Cannot instantiate pipes executor: invalid pipesBufferSize parameter value');
    this.maxConcurrent = concurrent;
    this.running = 0;
    this.maxBufferSize = bufferSize;
    this.buffer = new Denque();
  }

  /**
   * @warning Critical code section
   *
   * Pipes can be run thousands of times per seconds
   */
  run (chain, callback) {
    if (this.running >= this.maxConcurrent) {
      if (this.buffer.length >= this.maxBufferSize) {
        callback(errorsManager.get('too_many_pipes'));
      }
      else {
        this.buffer.push(new PipeChain(chain, callback));
      }

      return;
    }

    this.running++;

    // Create a context for the async.waterfall callback
    const callbackContext = {
      instance: this,
      callback
    };
    async.waterfall(chain, waterfallCallback.bind(callbackContext));
  }

  _runNext () {
    if (this.buffer.isEmpty() || this.running >= this.maxConcurrent) {
      return;
    }

    const pipe = this.buffer.shift();

    this.run(pipe.chain, pipe.callback);
  }
}

module.exports = PipeRunner;
