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

import Rights from './rights';
import Bluebird from 'bluebird';
import _ from 'lodash';
import kerror from '../../kerror';
import { Profile } from './profile';
import { KuzzleRequest } from '../../../index';
import { Target } from '../../types';

/**
 * @class User
 */
export class User {
  public _id: string;
  public profileIds: string[];

  constructor () {
    this._id = null;
    this.profileIds = [];
  }

  /**
   * @returns {Promise<Profile[]>}
   */
  getProfiles (): Promise<Profile[]> {
    if (! global.kuzzle) {
      return kerror.reject('security', 'user', 'uninitialized', this._id);
    }

    return global.kuzzle.ask('core:security:profile:mGet', this.profileIds);
  }

  /**
   * @returns {Promise}
   */
  async getRights () {
    const profiles = await this.getProfiles();
    const results = await Bluebird.map(profiles, p => p.getRights());

    const rights = {};

    results.forEach(right => _.assignWith(rights, right, Rights.merge));

    return rights;
  }

  /**
   * @param {Request} request
   * @returns {Promise.<boolean>}
   */
  async isActionAllowed (request: KuzzleRequest): Promise<boolean> {
    if (this.profileIds === undefined || this.profileIds.length === 0) {
      return false;
    }

    const targets = request.getArray('targets', []);

    const profiles = await this.getProfiles();
    if (targets.length === 0) {
      for (const profile of profiles) {
        if (await profile.isActionAllowed(request)) {
          return true;
        }
      }

      return false;
    }

    // Every target must be allowed by at least one profile
    return this.areTargetsAllowed(profiles, targets);
  }

  /**
   * Verifies that every targets are allowed by at least one profile,
   * while skipping the ones that includes a wildcard since they will be expanded
   * later on, based on index and collections authorized for the given user.
   */
  private async areTargetsAllowed (profiles: Profile[], targets: Target[]) {
    const profilesPolicies = await Bluebird.map(profiles, profile => profile.getAllowedPolicies());

    // Every target must be allowed by at least one profile
    for (const target of targets) {

      // Skip targets with no Index or Collection
      if (! target.index || ! target.collections) {
        continue;
      }

      // TODO: Support Wildcard
      if (target.index.includes('*')) {
        return false;
      }

      for (const collection of target.collections) {
        // TODO: Support Wildcard
        if (collection.includes('*')) {
          return false;
        }
        
        const isTargetAllowed = profilesPolicies.some(
          policies => policies.some(
            policy => policy.role.checkRestrictions(
              target.index,
              collection,
              policy.restrictedTo
            )
          )
        );

        if (! isTargetAllowed) {
          return false;
        }
      }
    }

    return true;
  }

}