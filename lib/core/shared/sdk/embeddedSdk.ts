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
  RealtimeController,
  Notification,
  JSONObject,
  ScopeOption,
  UserOption,
  Kuzzle,
} from 'kuzzle-sdk';

import _ from 'lodash';
import { RequestPayload, ResponsePayload } from '../../../types';
import FunnelProtocol from './funnelProtocol';
import { isPlainObject } from '../../../util/safeObject';
import * as kerror from '../../../kerror';
import ImpersonatedSDK from './impersonatedSdk';

const contextError = kerror.wrap('plugin', 'context');

const forbiddenEmbeddedActions = {
  'auth': new Set([
    'getCurrentUser',
    'checkRights',
    'createApiKey',
    'createMyCredentials',
    'credentialsExist',
    'deleteApiKey',
    'getMyCredentials',
    'getMyRights',
    'getStrategies',
    'logout',
    'refreshToken',
    'searchApiKeys',
    'updateMyCredentials',
    'updateSelf',
    'validateMyCredentials',
  ]),
};

const warningEmbeddedActions = {
  'auth': {
    'login': 'EmbeddedSdk\'s auth:login is deprecated, use user impersonation instead',
  }
};

interface EmbeddedRealtime extends RealtimeController {
  /**
   * Subscribes by providing a set of filters: messages, document changes
   * and, optionally, user events matching the provided filters will generate
   * real-time notifications.
   *
   * @see https://docs.kuzzle.io/core/2/guides/main-concepts/realtime-engine/
   *
   * @param index Index name
   * @param collection Collection name
   * @param filters Optional subscription filters
   * @param callback Callback function to handle notifications
   * @param options Additional options
   *    - `scope` Subscribe to document entering or leaving the scope. (default: 'all')
   *    - `users` Subscribe to users entering or leaving the room. (default: 'none')
   *    - `subscribeToSelf` Subscribe to notifications fired by our own queries. (default: true)
   *    - `volatile` Subscription information sent alongside notifications. (default: `{}`)
   *    - `propagate` Propagate the callback execution on each cluster node. (default: false)
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

  constructor () {
    super(new FunnelProtocol(), { autoResubscribe: false });
  }

  /**
   * Returns a new SDK impersonated with the provided user.
   *
   * @param user - User to impersonate the SDK with
   * @param options - Optional sdk arguments
   */
  as (user: { _id: string }, options = { checkRights: false }): EmbeddedSDK {
    if (! isPlainObject(user) || typeof user._id !== 'string') {
      throw contextError.get('invalid_user');
    }

    return new ImpersonatedSDK(user._id, options) as EmbeddedSDK;
  }

  /**
   * Sends an API request to Kuzzle.
   *
   * This is a low-level method, exposed to allow advanced SDK users to bypass
   * high-level methods.
   *
   * @param request - API request (https://docs.kuzzle.io/core/2/guides/main-concepts/1-api#other-protocols)
   * @param options - Optional arguments
   */
  query (
    request: RequestPayload,
    options: { propagate?: boolean } = {}
  ): Promise<ResponsePayload> {
    // By default, do not propagate realtime notification accross cluster nodes
    if ( isPlainObject(request)
      && request.controller === 'realtime'
      && request.action === 'subscribe'
    ) {
      request.propagate = options.propagate === undefined || options.propagate === null
        ? false
        : options.propagate;
    }

    if (forbiddenEmbeddedActions[request.controller] !== undefined
      && forbiddenEmbeddedActions[request.controller].has(request.action)
    ) {
      throw kerror.get(
        'api',
        'process',
        'deprecated_embedded_sdk_action',
        request.action,
        request.controller,
        'use user impersonation instead',
      );
    }

    const warning = _.get(warningEmbeddedActions, [request.controller, request.action]);
    if (warning) {
      global.app.log.warn(warning);
    }

    return super.query(request, options);
  }
}
