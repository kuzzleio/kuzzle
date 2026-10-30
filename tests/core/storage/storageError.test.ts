import { describe, expect, it } from "vitest";

import { storageError } from "../../../lib/core/storage/storageError";
import { NotFoundError } from "../../../lib/kerror/errors";
import * as kuzzleIndex from "../../../index";

describe("storageError", () => {
  it("is exported by kuzzle, for the storage drivers", () => {
    expect(kuzzleIndex.storageError).toBe(storageError);
  });

  it("builds Kuzzle's services.storage errors", async () => {
    const error = storageError.get("not_found", "id", "index", "collection");

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.id).toBe("services.storage.not_found");
    expect(error.message).toBe(
      'Document "id" not found in "index":"collection".',
    );
    await expect(storageError.reject("not_connected")).rejects.toMatchObject({
      id: "services.storage.not_connected",
    });
    expect(
      storageError.getFrom(new Error("engine"), "unexpected_error", "engine"),
    ).toMatchObject({ id: "services.storage.unexpected_error" });
  });
});
