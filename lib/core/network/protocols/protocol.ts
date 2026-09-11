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

import assert from "node:assert";

import bytes from "../../../util/bytes";
import { NetworkEntryPoint } from "../networkEntryPoint";

/**
 * @typeParam TConfig - the shape of `server.protocols.<name>` in the Kuzzle
 *                      configuration, which is what `init` copies into
 *                      `this.config`
 */
class Protocol<TConfig = Record<string, unknown>> {
  public maxRequestSize: number | null;
  public entryPoint: NetworkEntryPoint | null;
  public name: string;
  public config: TConfig;
  public initCalled: boolean;

  constructor(name = "") {
    this.maxRequestSize = null;
    this.entryPoint = null;
    this.name = name;
    this.config = {} as TConfig;

    this.initCalled = false;

    Reflect.defineProperty(this, "_kuzzle", {
      value: null,
      writable: true,
    });
  }

  /**
   * @param name - Protocol name (used for accessor) @deprecated
   *
   * The first parameter carries two shapes on purpose: `entryPoint` calls
   * `protocol.init(entryPoint)` on every subclass, while the subclasses call
   * `super.init(null, entryPoint)` here. Third-party protocols may still use
   * the deprecated `(name, entryPoint)` form, so the signature keeps both.
   */
  async init(
    name: string | null | NetworkEntryPoint,
    entryPoint?: NetworkEntryPoint,
  ): Promise<boolean> {
    this.entryPoint = entryPoint;

    // name should be passed in the constructor
    assert(
      this.name && !name,
      "A name has been given in the constructor and init method. Passing the name in the init method is deprecated.",
    );

    if (!this.name) {
      // only reachable when `name` is falsy: the assert above throws otherwise
      this.name = typeof name === "string" ? name : "";
    }

    this.maxRequestSize = bytes(entryPoint.config.maxRequestSize);

    assert(
      typeof this.name === "string" && this.name.length > 0,
      'Invalid "name" parameter value: expected a non empty string value',
    );

    const protocolsConfig = entryPoint.config.protocols;

    // the config is keyed by protocol name, which is only known at runtime
    if (protocolsConfig && Reflect.get(protocolsConfig, this.name)) {
      this.config = Reflect.get(protocolsConfig, this.name) as TConfig;
    }

    assert(
      Number.isInteger(this.maxRequestSize),
      'Invalid "maxRequestSize" parameter value: expected a numeric value',
    );

    this.initCalled = true;

    return true;
  }

  broadcast(data?: unknown): void;
  broadcast(): void {
    // do nothing by default
  }

  joinChannel(channel: string, connectionId: string) {
    // do nothing by default
    return { channel, connectionId };
  }

  leaveChannel(channel: string, connectionId: string) {
    // do nothing by default
    return { channel, connectionId };
  }

  notify(data?: unknown): void;
  notify(): void {
    // do nothing by default
  }
}

export = Protocol;
