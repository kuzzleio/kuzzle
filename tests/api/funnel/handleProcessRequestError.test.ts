import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Funnel from "../../../lib/api/funnel";
import { KuzzleRequest } from "../../../lib/api/request";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { PluginImplementationError } from "../../../lib/kerror/errors/pluginImplementationError";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#api/funnel.handleProcessRequestError", () => {
  let funnel: Funnel;
  let pipe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    /*
     * The subject calls `pipe` twice — the action's own `error` event, then
     * `request:onError` — and counts a failure on the statistics module. Those
     * three are its entire contact with the application; `statistics` is here
     * because the second half of the method is unreachable without it, not
     * because anything below asserts on it.
     */
    pipe = vi.fn();
    stubKuzzle({ pipe, statistics: { failedRequest: () => {} } });
    funnel = new Funnel();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  const pluginRequest = () =>
    new KuzzleRequest({ action: "fail", controller: "fakePlugin/controller" });

  it("lets a plugin replace the error from the request:onError event", async () => {
    const originalError = new BadRequestError("original error");
    const customError = new BadRequestError("custom error");
    const request = pluginRequest();

    pipe
      .mockRejectedValueOnce(originalError)
      .mockImplementationOnce(async (_event, req: KuzzleRequest) => {
        req.setError(customError);
        return req;
      });

    /*
     * The Mocha spec drove this through `done`, which passes if neither
     * branch ever runs. `rejects.toThrow` cannot: a resolution is a failure.
     */
    const rejection = funnel.handleProcessRequestError(
      request,
      request,
      originalError,
    );

    await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
    await expect(rejection).rejects.toMatchObject({
      message: "custom error",
    });
  });

  it("wraps a plain Error raised by a plugin's pipe", async () => {
    const originalError = new BadRequestError("original error");
    const request = pluginRequest();

    pipe.mockRejectedValueOnce(originalError).mockImplementationOnce(() => {
      throw new Error("custom error");
    });

    const rejection = funnel.handleProcessRequestError(
      request,
      request,
      originalError,
    );

    await expect(rejection).rejects.toBeInstanceOf(PluginImplementationError);
    await expect(rejection).rejects.toMatchObject({
      id: "plugin.runtime.unexpected_error",
    });
  });

  /*
   * TD-27 (#2703): `_wrapError` sits downstream of the error pipes, so what
   * reaches it comes from plugin code whatever the request's controller is.
   * A controller's own error is normalized upstream, by `_wrapControllerError`.
   */
  it("wraps a pipe error as a plugin error even on a native controller", async () => {
    const originalError = new BadRequestError("original error");
    const request = new KuzzleRequest({
      action: "fail",
      controller: "document",
    });

    funnel.controllers.set("document", {} as never);
    pipe.mockRejectedValueOnce(originalError).mockImplementationOnce(() => {
      throw new TypeError("cannot read properties of undefined");
    });

    const rejection = funnel.handleProcessRequestError(
      request,
      request,
      originalError,
    );

    await expect(rejection).rejects.toBeInstanceOf(PluginImplementationError);
    await expect(rejection).rejects.toMatchObject({
      id: "plugin.runtime.unexpected_error",
    });
  });

  it("leaves a KuzzleError raised by a pipe alone", async () => {
    const originalError = new BadRequestError("original error");
    const request = new KuzzleRequest({
      action: "fail",
      controller: "document",
    });

    funnel.controllers.set("document", {} as never);
    pipe.mockRejectedValueOnce(originalError).mockImplementationOnce(() => {
      throw new BadRequestError("raised by the pipe");
    });

    const rejection = funnel.handleProcessRequestError(
      request,
      request,
      originalError,
    );

    await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
    await expect(rejection).rejects.toMatchObject({
      message: "raised by the pipe",
    });
  });
});
