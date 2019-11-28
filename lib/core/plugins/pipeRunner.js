/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
  Denque = require('denque'),
  async = require('async'),
  {errors: {KuzzleError}} = require('kuzzle-common-objects'),
  errorsManager = require('../../util/errors').wrap('plugin', 'runtime');

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
 * Runs pipe chins if the number of already running concurrent pipes allows it.
 * Otherwise, delays the pipe chain until a slot is freed. If the storage
 * buffer is full, rejects the provided callback and discard the pipe chain.
 *
 * @param {Number} concurrent - max number of concurrent pipes
 * @param {Number} bufferSize - max number of delayed pipe chains
 */
class PipeRunner {
  constructor (concurrent, bufferSize) {
    this.maxConcurrent = concurrent;
    this.running = 0;
    this.maxBufferSize = bufferSize;
    this.buffer = new Denque();
  }

  run (chain, callback) {
    if (this.running >= this.maxConcurrent) {
      if (this.buffer.length >= this.maxBufferSize) {
        return callback(errorsManager.get('too_many_pipes'));
      }

      this.buffer.push(new PipeChain(chain, callback));
      return;
    }

    this.running++;

    async.waterfall(chain, (error, result) => {
      this.running--;

      if (!this.buffer.isEmpty()) {
        setImmediate(this._runNext.bind(this));
      }

      if (error) {
        return callback(error instanceof KuzzleError
          ? error
          : errorsManager.getFrom(error, 'unexpected_error', error.message));
      }

      callback(null, result);
    });
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
