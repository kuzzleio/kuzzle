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

import { JSONObject } from 'kuzzle-sdk';

import { BadRequestError } from '../kerror/errors';
import { SerializedState } from './state';

const REDIS_PREFIX = '{cluster/node}/';

type StateSyncEntry = {
  topic: string;

  message: string;

  state: string;
};

function parseInteger (integerString: string): number {
  const integer = parseInt(integerString, 10);

  if (isNaN(integer)) {
    throw new BadRequestError(`Cannot parse "${integerString}" into an integer.`);
  }

  return integer;
}

export class StateSyncHistory {
  /**
   * List of topics that modify the full state
   */
  static SYNC_TOPICS = [
    // Realtime sync messages
    'NewRealtimeRoom', 'RemoveRealtimeRoom', 'Subscription', 'Unsubscription',

    // Auth strategy sync messages
    'NewAuthStrategy', 'RemoveAuthStrategy',
  ];

  /**
   * If this key is set with, each node will keep state sync messages
   * and the full state into a fixed length array.
   *
   * This history will be saved into Redis when a desync error occur.
   *
   * This key value is the TTL of the sync history in ms.
   *
   * @example
   *
   * 7 days: 604800000 ms
   * 1 day:   86400000 ms
   */
  static REDIS_KEY_SYNC_HISTORY_TTL = REDIS_PREFIX + 'sync-history-ttl';

  /**
   * Max entries for the state sync history.
   *
   * Each entry is composed of:
   *  - topic (e.g. NewRealtimeRoom)
   *  - message
   *  - current fullstate before the message processing
   */
  static REDIS_KEY_SYNC_HISTORY_MAX_ENTRIES = REDIS_PREFIX + 'sync-history-max-entries';

  private enabledTimer: any;
  private historyTTL: number = null;
  private redisKeySyncHistory: string;
  private entries: StateSyncEntry[];
  private maxEntries = 200;

  constructor (nodeId: string) {
    this.redisKeySyncHistory = REDIS_PREFIX + `${nodeId}/sync-history`;

    /**
     * Instead of making a request to Redis for every sync message, we are checking
     * every 5 seconds if this config is still the same.
     *
     * This should be replaced with the cluster common synchronization mechanism
     * once is ready.
     */
    this.enabledTimer = setInterval(async () => {
      try {
        const [ historyTTL, maxEntries ] = await Promise.all([
          global.kuzzle.ask(
            'core:cache:public:get',
            StateSyncHistory.REDIS_KEY_SYNC_HISTORY_TTL),
          global.kuzzle.ask(
            'core:cache:public:get',
            StateSyncHistory.REDIS_KEY_SYNC_HISTORY_MAX_ENTRIES)
        ]);

        if (historyTTL) {
          this.historyTTL = parseInteger(historyTTL);
          this.maxEntries = parseInteger(maxEntries);

          return;
        }
      }
      catch (error) {
        global.kuzzle.log.error(`[CLUSTER] Cannot get the state sync history TTL or max entries: ${error}`);
      }

      this.historyTTL = null;
      this.maxEntries = 200;
    }, 5 * 1000);
  }

  /**
   * Returns true if an historyTTL has been set in Redis and if the current
   * topic should be historized.
   */
  enabled (topic: string): boolean {
    if (this.historyTTL === null) {
      return false;
    }

    return StateSyncHistory.SYNC_TOPICS.includes(topic);
  }

  /**
   * Clear the timer
   */
  dispose () {
    if (this.enabledTimer) {
      clearInterval(this.enabledTimer);
    }

    this.enabledTimer = null;
  }

  /**
   * Push a new state sync history entry.
   *
   * If the size exceed to maximum size, the first item will be removed.
   */
  push (topic: string, message: JSONObject, state: SerializedState) {
    if (this.entries.length + 1 > this.maxEntries) {
      this.entries.shift();
    }

    this.entries.push({
      topic,
      message: JSON.stringify(message),
      state: JSON.stringify(state)
    });
  }

  /**
   * Save the state sync history into Redis
   */
  async save (): Promise<void> {
    const serialized = JSON.stringify(this.entries);

    try {
      await global.kuzzle.ask(
        'core:cache:public:store',
        this.redisKeySyncHistory,
        serialized,
        { ttl: this.historyTTL });
    }
    catch (error) {
      global.kuzzle.log.error(`[CLUSTER] Cannot save the state sync history: ${error}`);
      global.kuzzle.log.info(serialized);
    }
  }
}
