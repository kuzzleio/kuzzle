/**
 * The smallest stand-in for an `@elastic/elasticsearch` client.
 *
 * `test/mocks/service/elasticsearchClient.mock.js` declares its 40-odd stubs
 * by hand, which means a spec that exercises a client call the mock never
 * heard of fails on `undefined is not a function` rather than on its own
 * assertion — and every new call site has to be added there first. This one
 * auto-vivifies instead: reading any property answers a stable `vi.fn` that
 * resolves `undefined`, so a command needs no declaration to be asserted on.
 *
 * Same move as the `stubRedis()` proxy [step 13, L1b3], for the same reason.
 *
 * Nothing is pre-armed. `_initSequence` would read `info()` and
 * `cluster.health()`, but it returns early whenever `_client` is already set —
 * which is exactly how a spec installs this stub — so arming them here would
 * be fixture no test ever reaches.
 */
import { vi } from "vitest";

type Stub = ReturnType<typeof vi.fn>;

/**
 * A namespace whose every property is a memoised `vi.fn`. The memoisation is
 * the point: `client.indices.refresh` read twice has to be the *same* spy, or
 * arming it in a `beforeEach` and asserting it in an `it` would touch two
 * different functions.
 */
function stubNamespace() {
  /*
   * The stub is written back onto the target rather than kept in a side map,
   * so every other trap — `in`, `Object.keys`, a failure message's dump —
   * sees exactly what the spec has touched, with no proxy invariant to honour
   * by hand.
   */
  return new Proxy({} as Record<string, Stub>, {
    get(target, property: string | symbol) {
      if (typeof property !== "string" || property in target) {
        return Reflect.get(target, property);
      }

      target[property] = vi.fn().mockResolvedValue(undefined);

      return target[property];
    },
  });
}

export interface ESClientStub extends Record<string, Stub> {
  cat: Record<string, Stub> & Stub;
  cluster: Record<string, Stub> & Stub;
  indices: Record<string, Stub> & Stub;
}

export function stubESClient(): ESClientStub {
  const namespaces: Record<string, Record<string, Stub>> = {
    cat: stubNamespace(),
    cluster: stubNamespace(),
    indices: stubNamespace(),
  };

  return new Proxy(stubNamespace(), {
    get: (target, property: string | symbol) =>
      typeof property === "string" && property in namespaces
        ? namespaces[property]
        : Reflect.get(target, property),
  }) as unknown as ESClientStub;
}
