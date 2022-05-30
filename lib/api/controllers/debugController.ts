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

'use strict';

import { Request } from '../request';
import { NativeController } from './baseController';
import v8 from 'v8';
import Inspector from 'inspector';
import { HttpStream } from '../../types';
import * as kerror from '../../kerror' ;
import { relativeTimeRounding } from 'moment';
import { method } from 'lodash';

/**
 * @class DebugController
 */
export class DebugController extends NativeController {
  private inspector: Inspector.Session;
  private status = false;
  private events = new Map();

  constructor () {
    super([
      'heapSnapshot',
      'getHeapStatistics',
      'getHeapSpaceStatistics',
      'getHeapCodeStatistics',
      'setFlags',
      'collectGarbage',
      'enable',
      'disable',
      'post',
      'addListener',
      'removeListener',
    ]);

    this.inspector = new Inspector.Session();

    this.inspector.on('inspectorNotification', (message) => {
      const listeners = this.events.get(message.method);
      if (! listeners) {
        return;
      }

      for (const listener of listeners) {
        global.kuzzle.entryPoint._notify({
          connectionId: listener,
          channels: [message.method],
          payload: message,
        });
      }
    });
  }

  /**
   * Take a heap snapshot and returns the filename of the snapshot.
   * If the download parameter is set to true, the snapshot will be downloaded using an HTTP Stream instead of saved on the disk.
   * 
   * @param {Request} request
   */
  async heapSnapshot (request) {
    if (request.context.connection.protocol !== 'http') {
      throw new Error('Downloading heap snapshots is only supported over HTTP');
    }

    const stream = v8.getHeapSnapshot();

    const date = new Date();
    const filename = `heap-${date.getFullYear()}-${date.getMonth()}-${date.getDay()}-${date.getHours()}-${date.getMinutes()}.heapsnapshot`;
    request.response.configure({
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/json',
      }
    });

    return new HttpStream(stream);
  }

  /**
   * See https://nodejs.org/dist/latest-v16.x/docs/api/v8.html#v8getheapstatistics
   * 
   * @returns {Promise}
   */
  async getHeapStatistics () {
    return v8.getHeapStatistics();
  }

  /**
   * Returns statistics about the V8 heap spaces, i.e. the segments which make up the V8 heap.
   * See https://nodejs.org/dist/latest-v16.x/docs/api/v8.html#v8getheapspacestatistics
   * 
   * @returns {Promise}
   */
   async getHeapSpaceStatistics () {
    return v8.getHeapSpaceStatistics();
  }


  /**
   * See https://nodejs.org/dist/latest-v16.x/docs/api/v8.html#v8getheapcodestatistics
   */
  async getHeapCodeStatistics () {
    return v8.getHeapCodeStatistics();
  }

  /**
   * The v8.setFlagsFromString() method can be used to programmatically set V8 command-line flags. This method should be used with care. Changing settings after the VM has started may result in unpredictable behavior, including crashes and data loss; or it may simply do nothing.
   * See https://nodejs.org/dist/latest-v16.x/docs/api/v8.html#v8setflagsfromstringflags
   */
  async setFlags (request: Request) {
    const flags = request.getString('flags');

    return v8.setFlagsFromString(flags);
  }

  async collectGarbage () {
    return await this.inspectorPost('HeapProfiler.collectGarbage', {});
  }

  /**
   * Connect the debugger
   */
  async enable() {
    if (this.status) {
      return;
    }

    this.inspector.connect();
    this.status = true;
  }

  /**
   * Disconnect the debugger
   */
  async disable() {
    if (!this.status) {
      return;
    }

    this.inspector.disconnect();
    this.status = false;
  }

  /**
   * Trigger action from debugger directly following the Chrome Debug Protocol
   * See: https://chromedevtools.github.io/devtools-protocol/v8/
   */
  async post(request: Request) {
    const method = request.getString('method');
    const params = request.getBodyObject('params', {});

    return await this.inspectorPost(method, params);
  }

  async addListener(request: Request) {
    const event = request.getString('event');

    let listeners = this.events.get(event);
    if (! listeners) {
      listeners = [];
      this.events.set(event, listeners);
    }

    listeners.push(request.context.connection.id);
  }

  async removeListener(request: Request) {
    const event = request.getString('event');

  }

  private async inspectorPost (method: string, params: Object) {
    if (! this.status) {
      throw kerror.get('core', 'debugger', 'not_enabled');
    }

    let resolve, error;

    const promise = new Promise((res, rej) => {
      resolve = res;
      error = rej;
    });

    this.inspector.post(method, params, (err, res) => {
      if (err) {
        error(err);
      } else {
        resolve(res);
      }
    });

    return promise;
  }

  private async 
}
