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

// Add meaningful stacktrace in Node.js 10
// This is an altered version of https://github.com/AndreasMadsen/trace
// fixing a massive memleak with promise resolutions, at the price of least
// precise stacktraces (should be enough for dev purposes)
//
// @todo this entire module must be removed in Node.js 12

const
  chain = require('stack-chain'),
  asyncHook = require('async_hooks');

const traces = new Map();

Error.stackTraceLimit = 30;

chain.filter.attach((error, frames) => {
  return frames.filter(callSite => {
    const name = callSite && callSite.getFileName();
    return !name
      || (name !== 'async_hooks.js' && name !== 'internal/async_hooks.js');
  });
});

chain.extend.attach((error, frames) => {
  const lastTrace = traces.get(asyncHook.executionAsyncId());
  frames.push.apply(frames, lastTrace);
  return frames;
});

asyncHook
  .createHook({
    init: asyncInit,
    destroy: asyncDestroy,
    promiseResolve: asyncDestroy
  })
  .enable();

function getCallSites(skip) {
  const limit = Error.stackTraceLimit;

  Error.stackTraceLimit = limit + skip;
  const stack = chain.callSite({
    extend: false,
    filter: true,
    slice: skip
  });
  Error.stackTraceLimit = limit;

  return stack;
}

function equalCallSite(a, b) {
  const aFile = a.getFileName();
  const aLine = a.getLineNumber();
  const aColumn = a.getColumnNumber();

  if (aFile === null || aLine === null || aColumn === null) {
    return false;
  }

  return aFile === b.getFileName()
    && aLine === b.getLineNumber()
    && aColumn === b.getColumnNumber();
}

function asyncInit(asyncId, type, triggerAsyncId) {
  const trace = getCallSites(2);

  const parentTrace = traces.get(triggerAsyncId);

  if (parentTrace) {
    for (let i = parentTrace.length; i > 0 && trace.length > 1; i--) {
      if (equalCallSite(parentTrace[i], trace[trace.length - 1])) {
        trace.pop();
      }
    }

    if (triggerAsyncId !== 0) {
      trace.push(...parentTrace);
      trace.splice(Error.stackTraceLimit);
    }
  }

  traces.set(asyncId, trace);
}

function asyncDestroy(asyncId) {
  traces.delete(asyncId);
}
