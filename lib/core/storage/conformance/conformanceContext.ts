/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2026 Kuzzle
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

import assert from "node:assert/strict";

import get from "lodash/get";
import has from "lodash/has";

import type { JSONObject } from "../../../types/JSONObject";
import type {
  StorageCapability,
  StorageDriver,
} from "../../../types/storage/StorageDriver";

/** What the conformance cases share: the drivers under test and their index */
export class ConformanceContext {
  private publicInstance?: StorageDriver;
  private privateInstance?: StorageDriver;
  private collectionCount = 0;

  constructor(
    /** The index the kit creates in the public scope, then deletes */
    readonly index: string,
    readonly capabilities: ReadonlySet<StorageCapability>,
  ) {}

  /** The public scope's driver instance, set before any case runs */
  get driver(): StorageDriver {
    assert.ok(this.publicInstance, "the driver is not initialized");
    return this.publicInstance;
  }

  /** The private scope's driver instance */
  get privateDriver(): StorageDriver {
    assert.ok(this.privateInstance, "the driver is not initialized");
    return this.privateInstance;
  }

  setDrivers(publicDriver: StorageDriver, privateDriver: StorageDriver): void {
    this.publicInstance = publicDriver;
    this.privateInstance = privateDriver;
  }

  /** A name no other case of this run uses */
  uniqueName(prefix: string): string {
    this.collectionCount += 1;
    return `${prefix}-${this.collectionCount}`;
  }

  /** Creates a collection of the kit's index, with the kit's mappings */
  async collection(prefix: string): Promise<string> {
    const collection = this.uniqueName(prefix);

    await this.driver.createCollection(this.index, collection, {
      mappings: CONFORMANCE_MAPPINGS,
    });

    return collection;
  }
}

/** The mappings of the collections the kit creates */
export const CONFORMANCE_MAPPINGS: JSONObject = {
  properties: {
    age: { type: "integer" },
    city: { type: "keyword" },
    name: { type: "keyword" },
  },
};

/**
 * Asserts that `promise` rejects with the Kuzzle error `expected`: its id, or
 * its HTTP status
 */
export async function rejectsWith(
  promise: Promise<unknown>,
  expected: string | number,
): Promise<void> {
  const key = typeof expected === "string" ? "id" : "status";

  await assert.rejects(promise, (error: unknown) => {
    assert.equal(
      field(error, key),
      expected,
      `expected the Kuzzle error ${key} ${JSON.stringify(expected)}, got: ${String(error)}`,
    );
    return true;
  });
}

/** A field of a document or an answer, by its dotted path */
export function field(object: unknown, path: string): unknown {
  return get(object, path);
}

export function hasField(object: unknown, path: string): boolean {
  return has(object, path);
}
