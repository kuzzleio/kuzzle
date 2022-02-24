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

import { KuzzleError, } from '../../kerror/errors';
import * as kerror from '../../kerror';
import { ApplicationManager, Backend } from './index';
import { ErrorDefinition } from '../../types';

export class BackendErrors extends ApplicationManager {
  public readonly applicationDomain: {
    [subDomain: string]: {
      [errorName: string]: ErrorDefinition
    };
  } = {};

  constructor (application: Backend) {
    super(application);
  }

  /**
   * Register a new standard KuzzleError
   *
   * @param subDomain Subdomain name
   * @param name Standard error name
   * @param definition Standard error definition
   */
  register (subDomain: string, name: string, definition: ErrorDefinition) {
    if (! this.applicationDomain[subDomain]) {
      this.applicationDomain[subDomain] = {};
    }

    this.applicationDomain[subDomain][name] = definition;
  }

  /**
   * Get a standardized KuzzleError
   *
   * @param subDomain Subdomain name
   * @param name Standard error name
   * @param placeholders Other placeholder arguments
   *
   * @returns Standardized KuzzleError
   */
   get (subDomain: string, name: string, ...placeholders): KuzzleError {
    return kerror.get('application', subDomain, name, ...placeholders);
  }

  /**
   * Get a standardized KuzzleError from an existing error to keep the stacktrace
   *
   * @param source Original error
   * @param subDomain Subdomain name
   * @param name Standard error name
   * @param placeholders Other placeholder arguments
   *
   * @returns Standardized KuzzleError
   */
  getFrom (source: Error, subDomain: string, name: string, ...placeholders): KuzzleError {
    return kerror.getFrom(source, 'application', subDomain, name, ...placeholders);
  }

  /**
   * Wrap an error manager on the subDomain
   *
   * @param subDomain Subdomain to wrap to
   */
  wrap (subDomain: string) {
    return kerror.wrap('application', subDomain);
  }
}
