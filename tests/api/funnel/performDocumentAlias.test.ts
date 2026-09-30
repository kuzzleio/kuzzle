import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Funnel from "../../../lib/api/funnel";
import { KuzzleRequest } from "../../../lib/api/request";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#api/funnel.performDocumentAlias", () => {
  let funnel: Funnel;
  let pipe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    /*
     * The subject reads the alias table its own constructor loads, and calls
     * exactly one thing on the global: `pipe`. Nothing else here is
     * application state, which is why no application stub is needed — and the
     * stub has to *return* its documents, because the result is fed straight
     * back into `DocumentExtractor.insert`.
     */
    pipe = vi.fn(async (_event, documents) => documents);
    stubKuzzle({ pipe });
    funnel = new Funnel();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("triggers the generic before-write pipe for an aliased action", async () => {
    const request = new KuzzleRequest({
      action: "create",
      body: { foo: "bar" },
      controller: "document",
    });

    await funnel.performDocumentAlias(request, "before");

    expect(pipe).toHaveBeenCalledTimes(1);
    const [event, documents, original] = pipe.mock.calls[0];
    expect(event).toBe("generic:document:beforeWrite");
    /*
     * The Mocha spec asserted `be.type("object")` on both payloads, which
     * `{}` and `[]` satisfy. What the pipe is actually handed is the extracted
     * document list and the request it came from.
     */
    expect(documents).toEqual([{ _id: undefined, _source: { foo: "bar" } }]);
    expect(original).toBe(request);
  });

  it("triggers the generic after-write pipe for an aliased action", async () => {
    const request = new KuzzleRequest({
      action: "create",
      body: { foo: "bar" },
      controller: "document",
    });

    await funnel.performDocumentAlias(request, "after");

    expect(pipe).toHaveBeenCalledTimes(1);
    const [event, documents, original] = pipe.mock.calls[0];
    expect(event).toBe("generic:document:afterWrite");
    expect(documents).toEqual([{ _id: undefined, _source: { foo: "bar" } }]);
    expect(original).toBe(request);
  });

  it("triggers nothing for an action the alias table does not cover", async () => {
    const request = new KuzzleRequest({
      action: "search",
      controller: "document",
    });

    await funnel.performDocumentAlias(request, "before");

    expect(pipe).not.toHaveBeenCalled();
  });

  /*
   * Not covered by the Mocha spec: the early returns hand the request back
   * unchanged, and every caller reassigns from the return value — so a
   * `return` dropped here would silently replace a request with `undefined`.
   */
  it("returns the request untouched when it triggers nothing", async () => {
    const request = new KuzzleRequest({
      action: "search",
      controller: "document",
    });

    expect(await funnel.performDocumentAlias(request, "before")).toBe(request);
  });

  it("triggers nothing for a controller other than document", async () => {
    const request = new KuzzleRequest({
      action: "create",
      controller: "security",
    });

    expect(await funnel.performDocumentAlias(request, "before")).toBe(request);
    expect(pipe).not.toHaveBeenCalled();
  });
});
