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

import {
  KuzzleRequest,
  KuzzleResponse,
  RealtimeController,
  Notification,
  JSONObject,
  ScopeOption,
  UserOption,
  Kuzzle,
} from '../../../../../sdk-javascript'

import FunnelProtocol from './funnelProtocol';
import { isPlainObject } from '../../../util/safeObject';
import kerror from '../../../kerror';

const contextError = kerror.wrap('plugin', 'context');

interface EmbeddedRealtime extends RealtimeController {
  /**
   * Subscribes by providing a set of filters: messages, document changes
   * and, optionally, user events matching the provided filters will generate
   * real-time notifications.
   *
   * @see https://docs.kuzzle.io/core/2/guides/main-concepts/6-realtime-engine/
   *
   * @param index Index name
   * @param collection Collection name
   * @param filters Optional subscription filters
   * @param callback Callback function to handle notifications
   * @param options Additional options
   *    - `scope` Subscribe to document entering or leaving the scope. (default: 'all')
   *    - `users` Subscribe to users entering or leaving the room. (default: 'none')
   *    - `subscribeToSelf` Subscribe to notifications fired by our own queries. (default: true)
   *    - `volatile` Subscription information sent alongside notifications
   *    - `propagate` Propagate the callback execution on each cluster node
   *
   * @returns A string containing the room ID
   */
  subscribe (
    index: string,
    collection: string,
    filters: JSONObject,
    callback: (notification: Notification) => void | Promise<void>,
    options?: {
      /**
       * Subscribe to document entering or leaving the scope. (default: 'all')
       */
      scope?: ScopeOption;
      /**
       * Subscribe to users entering or leaving the room. (default: 'none')
       */
      users?: UserOption;
      /**
       * Subscribe to notifications fired by our own queries. (default: true)
       */
      subscribeToSelf?: boolean;
      /**
       * Subscription information sent alongside notifications
       */
      volatile?: JSONObject;
      /**
       * Propagate the callback execution on each cluster node (default: false)
       */
      propagate?: boolean;
    }
  ): Promise<string>
}

/**
 * Kuzzle embedded SDK to make API calls inside applications or plugins.
 */
export class EmbeddedSDK extends Kuzzle {
  realtime: EmbeddedRealtime;

  /**
   * @param kuzzle - Kuzzle object
   * @param user - User to impersonate the SDK with
   */
  constructor (kuzzle, user?) {
    super(new FunnelProtocol(kuzzle, user), { autoResubscribe: false });

    Reflect.defineProperty(this, '_kuzzle', {
      value: kuzzle
    });
  }

  protected get kuzzle () {
    return this._kuzzle;
  }

  /**
   * Returns a new SDK impersonated with the provided user.
   *
   * @param user - User to impersonate the SDK with
   */
  as (user: { _id: string }) {
    if (! isPlainObject(user) || typeof user._id !== 'string') {
      throw contextError.get('invalid_user');
    }

    return new EmbeddedSDK(this._kuzzle, user);
  }

  /**
   * Sends an API request to Kuzzle.
   *
   * This is a low-level method, exposed to allow advanced SDK users to bypass
   * high-level methods.
   *
   * @param request - API request (https://docs.kuzzle.io/core/2/api/essentials/query-syntax/#other-protocols)
   * @param options - Optional arguments
   */
  query (
    request: KuzzleRequest,
    options: { propagate?: boolean } = {}
  ): Promise<KuzzleResponse> {
    // By default, do not propagate realtime notification accross cluster nodes
    if ( isPlainObject(request)
      && request.controller === 'realtime'
      && request.action === 'subscribe'
    ) {
      request.propagate = options.propagate === undefined || options.propagate === null
        ? false
        : options.propagate;

      if (this.kuzzle.running && process.env.NODE_ENV !== 'production') {
        this.kuzzle.log.warn('A realtime subscription has been made at runtime.\nRealtime subscriptions should only be made during Kuzzle initialization to ensure correct cluster replication.\nSee https://docs.kuzzle.io/core/2/plugins/plugin-context/accessors/sdk/#realtime-notifications for more information.');
      }
    }

    return super.query(request, options);
  }
}
