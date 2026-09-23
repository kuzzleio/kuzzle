/**
 * The shared body of the ES 7 and ES 8 `elasticsearch` specs.
 *
 * `test/service/storage/elasticsearch-7.test.js` and `-8.test.js` hold 12 431
 * lines between them — 19% of the remaining Mocha suite — and the same 54
 * action blocks twice. The subject is one dispatcher reading one config value,
 * so the spec is one body reading one {@link ESEnvelope}; see `envelope.ts`
 * for why the wire delta is a value the cases read rather than a helper that
 * hides it.
 *
 * Ported one case group at a time (step 13, L5a…L5e). Each group's blocks are
 * removed from both Mocha twins in the same PR that adds them here, so the two
 * suites never assert the same thing twice and the twins shrink to nothing
 * rather than being deleted on trust.
 *
 * Groups ported so far:
 *
 * | Group | Blocks | Slice |
 * | --- | --- | --- |
 * | `inventory` | 16 — wiring, listings, existence, naming | L5a |
 * | `crud` | 8 — the single-document actions | L5b |
 */
import { describe } from "vitest";

import { setupElasticsearch, type ESVersion } from "./harness";
import { describeCrud } from "./crud";
import { describeInventory } from "./inventory";

export function describeElasticsearch(version: ESVersion) {
  describe(`#service/storage/${version}/elasticsearch`, () => {
    const harness = setupElasticsearch(version);

    describeInventory(harness);
    describeCrud(harness);
  });
}
