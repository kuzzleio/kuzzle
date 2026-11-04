import { describe, expect, it } from "vitest";

import { storageError } from "../../../lib/core/storage/storageError";
import { NotFoundError } from "../../../lib/kerror/errors";
import * as kuzzleIndex from "../../../index";
import services from "../../../lib/kerror/codes/1-services.json";

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
      message: "Storage engine is not connected.",
    });
    expect(
      storageError.getFrom(new Error("engine"), "unexpected_error", "engine"),
    ).toMatchObject({ id: "services.storage.unexpected_error" });
  });

  // kuzzle#3143: a driver may target Elasticsearch or OpenSearch, so the
  // storage errors any driver raises do not name an engine
  it.each(["storage", "koncorde"] as const)(
    "words the services.%s messages without naming an engine",
    (subDomain) => {
      const { errors } = services.subDomains[subDomain];

      for (const [name, { message, description }] of Object.entries(errors)) {
        // The id is left out: renaming one is breaking
        expect(`${message} ${description}`, name).not.toMatch(
          /elastic|opensearch/i,
        );
      }
    },
  );
});
