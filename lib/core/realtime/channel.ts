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

import { RealtimeScope, RealtimeUsers } from '../../types';
import * as kerror from '../../kerror';

const realtimeError = kerror.wrap('core', 'realtime');

/**
 * A channel define how notifications should be send for a particular realtime
 * room.
 *
 * Channel names are sent back to users who subscribe to realtime notification,
 * then each notification sent to them contains the associated channel.
 *
 * It allows to makes two subscriptions on index + collection + filters but one
 * for documents entering the scope and the other for documents exiting the scope
 * for example.
 *
 * Channels define with more granularity if a room notification should be sent:
 *  - is the document entering or leaving the scope
 *  - should I notify when users join or leave the room
 *  - should I propagate the notification to other cluster nodes
 *
 * @property name
 * @property scope
 * @property users
 * @property cluster
 */
export class Channel {
  /**
   * Dummy hash function since we only need to keep the channel configuration.
   *
   * This is 10x faster than murmur.
   */
  static hash (channel: Channel) {
    let str = '';

    switch (channel.users) {
      case 'all':
        str += '1';
        break;
      case 'in':
        str += '2';
        break;
      case 'out':
        str += '3';
        break;
      case 'none':
        str += '3';
        break;
    }

    switch (channel.cluster) {
      case true:
        str += '1';
        break;
      case false:
        str += '2';
        break;
    }

    switch (channel.scope) {
      case 'all':
        str += '1';
        break;
      case 'in':
        str += '2';
        break;
      case 'out':
        str += '3';
        break;
    }

    return str;
  }

  static USERS_ALLOWED_VALUES = ['all', 'in', 'out', 'none'];

  static SCOPE_ALLOWED_VALUES = Channel.USERS_ALLOWED_VALUES;

  /**
   * Identifier of the channel.
   *
   * Result of roomId + hash(channel)
   */
  public name: string;

  /**
   * Define if notification should be send when documents are entering or leaving
   * the subscription scope.
   *
   * @default "all"
   */
  public scope: RealtimeScope;

  /**
   * Define if notification should be send when users join or leave the channel.
   *
   * @default "none"
   */
  public users: RealtimeUsers;

  /**
   * Define if the notification should be propagated on other cluster nodes or
   * only to connection subscribing on this node.
   *
   * This is used by the EmbeddedSDK realtime subscription to propagate or not
   * callback execution among other nodes.
   */
  public cluster: boolean;

  constructor (
    roomId: string,
    {
      scope = 'all',
      users = 'none',
      propagate = true,
    }: { scope?: RealtimeScope; users?: RealtimeUsers; propagate?: boolean } = {}
  ) {
    this.scope = scope;
    this.users = users;
    this.cluster = propagate;

    if (! Channel.SCOPE_ALLOWED_VALUES.includes(this.scope)) {
      throw realtimeError.get('invalid_scope');
    }

    if (! Channel.USERS_ALLOWED_VALUES.includes(this.users)) {
      throw realtimeError.get('invalid_users');
    }

    this.name = `${roomId}-${Channel.hash(this)}`;
  }
}
