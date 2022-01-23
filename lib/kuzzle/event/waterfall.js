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

class WaterfallContext {
  /**
   * @param  {Array}    chain  - list of functions to call
   * @param  {Array}    args   - function arguments
   * @param  {Function} cb     - end of waterfall callback
   * @param  {Object}   cbCtx  - functions context
   */
  constructor (chain, args, cb, cbCtx) {
    this.chain = chain;
    this.cb = cb;
    this.cbCtx = cbCtx;
    this.index = 0;

    // since we always add a callback, and since after the 1st chain function
    // there is always at least 1 arg which is the 1st function result (it
    // can be undefined), then we need to force at least 1 argument to make
    // sure that all pipe methods receive the same payload
    this.args = args.length ? args : [null];
  }

  hasNext () {
    return this.index < this.chain.length;
  }

  /**
   * Each function in the waterfall chain returns a result. This result should
   * always be the 1st payload argument (updated or left intact, it matters not)
   */
  set result (result) {
    this.args[0] = result;
  }

  next (cb) {
    this.index++;
    this.chain[this.index-1](...this.args, cb);
  }

  reject (error) {
    this.cb.call(this.cbCtx, error);
  }

  // Resolves with the updated payload
  resolve () {
    this.cb.call(this.cbCtx, null, ...this.args);
  }
}

/* eslint-disable no-invalid-this */
function waterfallCB (err, res) {
  if (err) {
    this.reject(err);
  }
  else {
    this.result = res;
    waterfallNext(this);
  }
}
/* eslint-enable no-invalid-this */

function waterfallNext (ctx) {
  if (! ctx.hasNext()) {
    ctx.resolve();
    return;
  }

  try {
    ctx.next(waterfallCB.bind(ctx));
  }
  catch (error) {
    ctx.reject(error);
  }
}

function waterfall (chain, args, cb, context) {
  const ctx = new WaterfallContext(chain, args, cb, context);

  waterfallNext(ctx);
}

module.exports = waterfall;
