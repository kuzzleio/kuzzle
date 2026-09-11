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
  public maxRequestSize: number | null = null;
  public entryPoint: NetworkEntryPoint | null = null;
  public name: string;
  public config: TConfig = {} as TConfig;
  public initCalled = false;

  constructor(name = "") {
    this.name = name;

    Reflect.defineProperty(this, "_kuzzle", {
      value: null,
      writable: true,
    });
  }

  /**
   * Initializes the protocol against the entry point that owns it.
   *
   * Two call shapes reach this method, and only one of them is alive:
   *
   *  - `init(entryPoint)` — what `entryPoint.js` calls on every protocol, and
   *    what a subclass should call on `super`;
   *  - `init(null, entryPoint)` — what the three in-tree subclasses currently
   *    call, and what a third-party protocol written against an older version
   *    still calls. Kept working, hence the implementation signature below.
   *
   * A *string* first argument is **not** a third shape. The parameter was
   * deprecated in #1645 (2020-06-16) by an assert that reads
   * `assert(this.name && !name)`, so passing a name here has thrown ever since
   * — including when no name was given to the constructor, which is the only
   * case the deprecation was meant to still allow. The signature says `null`
   * because `null` is what this method can accept. Widening it to
   * `string | null`, as the first TypeScript conversion did, advertised a call
   * that throws. ADR-0001, TD-41 (#2728).
   *
   * The assert is left exactly as it is: fixing it would re-open a path that
   * has been closed for five years, which is a decision about the plugin API,
   * not about this method's type.
   */
  async init(entryPoint: NetworkEntryPoint): Promise<boolean>;
  /** @deprecated pass the name to the constructor and call `init(entryPoint)` */
  async init(name: null, entryPoint: NetworkEntryPoint): Promise<boolean>;
  async init(
    nameOrEntryPoint: null | NetworkEntryPoint,
    maybeEntryPoint?: NetworkEntryPoint,
  ): Promise<boolean> {
    // The old shape puts the entry point second. Normalising here is what the
    // union in the first conversion left undone: the body read `maybeEntryPoint`
    // unconditionally, so `init(entryPoint)` type-checked and threw on
    // `entryPoint.config` (TD-41).
    const entryPoint =
      nameOrEntryPoint === null ? maybeEntryPoint : nameOrEntryPoint;

    // New: the call shapes above both crashed on `entryPoint.config` a few
    // lines down when the entry point was missing. Same outcome, with the
    // reason in the message — httpwsProtocol.js is still JavaScript and the
    // overloads do not constrain it.
    assert(
      entryPoint !== undefined && entryPoint !== null,
      'Invalid "entryPoint" parameter value: expected the network entry point',
    );

    this.entryPoint = entryPoint;

    // name should be passed in the constructor. The original condition was
    // `this.name && !name`; normalisation above proves the first argument is
    // never a name, so `!name` was constant-true. What remains is the half
    // that can fail, and it throws the same error it always did.
    assert(
      this.name,
      "A name has been given in the constructor and init method. Passing the name in the init method is deprecated.",
    );

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
