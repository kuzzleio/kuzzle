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

import * as kerror from "../kerror";

interface ServiceConfig {
  initTimeout?: number;
  [key: string]: unknown;
}

interface ServiceInfo {
  type: string;
  version: string;
}

/**
 * Services base class
 */
class Service<
  TConfig extends ServiceConfig = ServiceConfig,
  TInfo extends ServiceInfo = ServiceInfo,
> {
  protected readonly _name: string;
  protected readonly _config: TConfig;
  private readonly _initTimeout: number;

  constructor(name: string, config: TConfig) {
    this._name = name;
    this._config = config;
    this._initTimeout =
      config.initTimeout ||
      globalThis.kuzzle.config.services.common.defaultInitTimeout;
  }

  get config(): TConfig {
    return this._config;
  }

  get name(): string {
    return this._name;
  }

  /**
   * Call _initSequence to initialize the service
   * and throw an error if timeout exceed
   */
  init(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(kerror.get("core", "fatal", "service_timeout", this._name));
      }, this._initTimeout);

      this._initSequence().then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (error: Error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  /**
   * @abstract
   */
  _initSequence(): Promise<void> {
    throw new Error("Not implemented");
  }

  /**
   * @abstract
   */
  info(): Promise<TInfo> {
    throw new Error("Not implemented");
  }
}

export = Service;
