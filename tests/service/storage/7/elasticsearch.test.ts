import { vi } from "vitest";

import { describeElasticsearch } from "../elasticsearchCases";

vi.mock("../../../../lib/util/distributedLock", async (importOriginal) => {
  const { withLock } = await import("../elasticsearchCases/lockFixture");

  return {
    ...(await importOriginal<
      typeof import("../../../../lib/util/distributedLock")
    >()),
    withLock,
  };
});

describeElasticsearch("7");
