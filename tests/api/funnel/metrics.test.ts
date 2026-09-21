import { afterEach, beforeEach, describe, expect, it } from "vitest";

import Funnel from "../../../lib/api/funnel";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#api/funnel.metrics", () => {
  beforeEach(() => {
    /*
     * `metrics()` reads nothing off the global, and the constructor reads one
     * thing: `log.child()`, which the shared fixture already provides. That is
     * the whole dependency — stating it is the point of not reaching for
     * KuzzleMock, which would have made this spec look like it needed the
     * application. (The `onAsk` registration that exposes these counters as an
     * event lives in `init()`, so it is asserted in that spec, not here.)
     */
    stubKuzzle();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("reports the funnel's queue counters", () => {
    const funnel = new Funnel();

    expect(funnel.metrics()).toMatchObject({
      concurrentRequests: 0,
      pendingRequests: 0,
    });
  });

  /*
   * The Mocha spec asserted the two zeroes only, against a funnel that had
   * just been constructed — which two literals would also satisfy. This pins
   * the counters the numbers actually come from.
   */
  it("reports the counters it is holding, not constants", () => {
    const funnel = new Funnel();

    funnel.concurrentRequests = 3;
    funnel.pendingRequestsQueue.push("a-request-id");

    expect(funnel.metrics()).toMatchObject({
      concurrentRequests: 3,
      pendingRequests: 1,
    });
  });
});
