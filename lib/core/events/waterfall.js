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
  constructor(chain, payload, cb, cbCtx) {
    this.chain = chain;
    this.cb = cb;
    this.cbCtx = cbCtx;

    this.index = 0;
    this.result = payload;
  }
}

/* eslint-disable no-invalid-this */
function waterfallCB(err, ...res) {
  console.dir({err, res});
  if (err) {
    this.cb.call(this.cbCtx, err, null);
  }
  else {
    this.result = res;
    this.index++;
    waterfallNext(this);
  }
}
/* eslint-enable no-invalid-this */

function waterfallNext(ctx) {
  if (ctx.index === ctx.chain.length) {
    ctx.cb.call(ctx.cbCtx, null, ...ctx.result);
    return;
  }

  ctx.chain[ctx.index](...ctx.result, waterfallCB.bind(ctx));
}

function waterfall(chain, payload, cb, context) {
  const ctx = new WaterfallContext(chain, payload, cb, context);

  waterfallNext(ctx);
}

module.exports = waterfall;
