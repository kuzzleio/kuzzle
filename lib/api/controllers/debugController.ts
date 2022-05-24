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
import { HttpStream } from '../../types';

/**
 * @class DebugController
 */
export class DebugController extends NativeController {
  constructor () {
    super([
      'heapSnapshot',
      'getHeapStatistics',
      'getHeapSpaceStatistics',
      'getHeapCodeStatistics',
      'setFlags',
    ]);
  }

  /**
   * Take a heap snapshot and returns the filename of the snapshot.
   * If the download parameter is set to true, the snapshot will be downloaded using an HTTP Stream instead of saved on the disk.
   * 
   * @param {Request} request
   */
  async heapSnapshot (request) {
    if (request.getBoolean('download')) {
      if (request.context.connection.protocol !== 'http') {
        throw new Error('Downloading heap snapshots is only supported over HTTP');
      }

      const stream = v8.getHeapSnapshot();

      const date = new Date();
      const filename = `heap-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}.heapsnapshot`;
      request.response.configure({
        headers: {
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': 'application/json',
        }
      });

      return new HttpStream(stream);
    }

    return v8.writeHeapSnapshot();
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
   * The v8.setFlagsFromString() method can be used to programmatically set V8 command-line flags. This method should be used with care. Changing settings after the VM has started may result in unpredictable behavior, including crashes and data loss; or it may simply do nothing.
   * See https://nodejs.org/dist/latest-v16.x/docs/api/v8.html#v8getheapcodestatistics
   */
  async getHeapCodeStatistics () {
    return v8.getHeapCodeStatistics();
  }

  /**
   * See https://nodejs.org/dist/latest-v16.x/docs/api/v8.html#v8setflagsfromstringflags
   */
  async setFlags (request: Request) {
    const flags = request.getString('flags');

    return v8.setFlagsFromString(flags);
  }
}
