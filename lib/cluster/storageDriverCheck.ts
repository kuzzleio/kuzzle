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

// Every cluster node runs the same storage driver (ADR-0003, decision 9).
// The driver is known from the configuration and the driver's manifest, before
// any connection: a starting node compares it with the ID cards of the cluster
// before its storage initializes (#3139), and again at its handshake.

import Bluebird from "bluebird";

import * as kerror from "../kerror";
import { selectStorageDriver } from "../core/storage/storageDriverLoader";
import type { IKuzzleConfiguration } from "../types/config/KuzzleConfiguration";
import { getIdCards, idCardTtl, type IdCard } from "./idCardHandler";

const joinError = kerror.wrap("cluster", "join");

/**
 * The storage driver a node runs, as its ID card carries it: one of the two
 * fields is set, or neither on a node older than 2.61.0.
 */
export type StorageDriverIdentity = Pick<
  IdCard,
  "storageDriver" | "builtInStorageDriver"
>;

/**
 * The storage driver this node's configuration selects
 *
 * @throws {services.storage_driver.*} if it cannot be loaded
 */
export function localStorageDriver(
  config: IKuzzleConfiguration["services"]["storageEngine"],
): StorageDriverIdentity {
  const { identity, builtIn } = selectStorageDriver(config);

  return identity === null
    ? { builtInStorageDriver: builtIn ?? undefined }
    : { storageDriver: identity };
}

/**
 * Whether a node running `local` can join a node whose card says `remote`.
 *
 * - external drivers: same package, same version;
 * - built-in drivers: same package (the Elasticsearch major version), its
 *   version being Kuzzle's own, so that a rolling upgrade of Kuzzle goes on;
 * - a card with no driver at all is a node older than 2.61.0, which could
 *   only run a built-in driver of a major version it does not say: it is
 *   accepted by a built-in node, as before 2.61.0, and refused by an
 *   external one.
 */
function sameDriver(
  local: StorageDriverIdentity,
  remote: StorageDriverIdentity,
): boolean {
  if (local.storageDriver !== undefined || remote.storageDriver !== undefined) {
    return local.storageDriver === remote.storageDriver;
  }

  return (
    remote.builtInStorageDriver === undefined ||
    remote.builtInStorageDriver === local.builtInStorageDriver
  );
}

function describe({
  storageDriver,
  builtInStorageDriver,
}: StorageDriverIdentity): string {
  if (storageDriver !== undefined) {
    return storageDriver;
  }

  return builtInStorageDriver === undefined
    ? "a built-in Elasticsearch driver"
    : `the built-in driver ${builtInStorageDriver}`;
}

/**
 * @throws {cluster.join.storage_driver_mismatch} if a node runs another
 *   storage driver than `local`
 */
export function assertSameStorageDriver(
  local: StorageDriverIdentity,
  nodes: IdCard[],
): void {
  const other = nodes.find((node) => !sameDriver(local, node));

  if (other) {
    throw joinError.get(
      "storage_driver_mismatch",
      describe(local),
      other.id,
      describe(other),
    );
  }
}

/**
 * Compares this node's storage driver with the ID cards of the cluster
 * nodes, before this node touches the storage: a node refused here has
 * written nothing.
 *
 * A mismatching card can be a stale one, left by a node stopped without
 * cleaning up, as in the full cluster restart a driver change requires: it
 * is read again once it would have expired, and only a card still there
 * refuses this node.
 *
 * @throws {cluster.join.storage_driver_mismatch}
 */
export async function assertClusterStorageDriver(
  config: IKuzzleConfiguration,
): Promise<void> {
  const local = localStorageDriver(config.services.storageEngine);
  const other = (await getIdCards(null)).find(
    (node) => !sameDriver(local, node),
  );

  if (other === undefined) {
    return;
  }

  // A heartbeat more than the TTL: the card's last renewal may be in flight
  const delay = idCardTtl(config.cluster.heartbeat) + config.cluster.heartbeat;

  global.kuzzle.log.warn(
    `[CLUSTER] This node runs ${describe(local)}, but the cluster node ${other.id} runs ${describe(other)}. Waiting ${delay}ms for its ID card to expire, in case it is a stale one...`,
  );
  await Bluebird.delay(delay);

  assertSameStorageDriver(local, await getIdCards(null));
}
