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

import { Readable } from "stream";

export type HttpStreamProperties = {
  totalBytes?: number;
};

/**
 * A simple class used to wrap a Readable stream
 * and provide additional informations about the given data
 */
export class HttpStream {
  public readonly stream: Readable;
  public readonly totalBytes: number;
  private _destroyed = false;

  private get readableState() {
    // @ts-ignore
    return this.stream._readableState;
  }

  constructor(
    readableStream: Readable,
    { totalBytes = -1 }: HttpStreamProperties = {},
  ) {
    this.stream = readableStream;
    this.totalBytes = totalBytes;
    this._destroyed = readableStream.destroyed;
  }

  /**
   * Returns if the stream is errored
   */
  get errored(): boolean {
    return (
      this.readableState.errored !== null &&
      this.readableState.errored !== undefined
    );
  }

  /**
   * Get the error
   */
  get error(): Error {
    return this.readableState.errored;
  }

  /**
   * Returns if the stream has been destroyed
   */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Destroy the stream
   * true if the stream has been destroyed
   */
  destroy(): boolean {
    if (this._destroyed) {
      return false;
    }

    this.stream.destroy();
    this._destroyed = true;
    return true;
  }
}
