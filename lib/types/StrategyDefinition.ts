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

/**
 * Allows to define an authentication strategy
 */
export type StrategyDefinition = {
  /**
   * Strategy name and definition.
   */
  [name: string]: {
    /**
     * Strategy configuration.
     */
    config: {
      /**
       * Name of a registered authenticator to use with this strategy.
       */
      authenticator: string,
      [key: string]: any
    },
    /**
     * Strategy methods.
     *
     * Each method must be exposed by the plugin
     * under the same name as specified.
     */
    methods: {
      afterRegister?: string,
      create: string,
      delete: string,
      exists: string,
      getById?: string,
      getInfo?: string,
      update: string,
      validate: string,
      verify: string,
    }
  }
}
