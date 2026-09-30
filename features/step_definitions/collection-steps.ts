import { Then, Given } from "@cucumber/cucumber";
import should from "should";
import type KuzzleWorld from "../support/world";
import { invokeAction } from "../support/invoke";

Given(
  "a collection {string}:{string}",
  async function (this: KuzzleWorld, index, collection) {
    this.props.result = await this.sdk.collection.create(index, collection, {});

    this.props.index = index;
    this.props.collection = collection;
  },
);

Given(
  "an existing collection {string}:{string}",
  async function (this: KuzzleWorld, index, collection) {
    if (!(await this.sdk.index.exists(index))) {
      throw new Error(`Index ${index} does not exist`);
    }

    if (!(await this.sdk.collection.exists(index, collection))) {
      throw new Error(`Collection ${index}:${collection} does not exist`);
    }

    this.props.index = index;
    this.props.collection = collection;
  },
);

Then(
  "I {string} the collection {string}:{string} with:",
  async function (this: KuzzleWorld, action, index, collection, dataTable) {
    let mappings: unknown = {},
      settings: unknown = {};

    if (dataTable.rowsHash) {
      ({ mappings, settings } = this.parseObject(dataTable));
    }

    try {
      // @todo remove the condition when collection.update is available in sdk
      if (action === "update") {
        this.props.result = await this.sdk.query({
          action: "create",
          body: { mappings, settings },
          collection,
          controller: "collection",
          index,
        });
      } else {
        this.props.result = await invokeAction(
          this.sdk.collection,
          action,
          index,
          collection,
          { mappings, settings },
        );
      }

      this.props.index = index;
      this.props.collection = collection;
    } catch (error) {
      this.props.error = error;
    }
  },
);

Then(
  "I list {string} collections in index {string}",
  async function (this: KuzzleWorld, expectedType, index) {
    const { collections } = await this.sdk.collection.list(index);

    this.props.result = {
      collections: collections.filter(
        ({ type }: { type: string }) => type === expectedType,
      ),
    };
  },
);

Then(
  /I should( not)? see the collection "(.*?)":"(.*?)"/,
  async function (this: KuzzleWorld, not, index, collection) {
    const { collections } = await this.sdk.collection.list(index);

    const collectionNames = collections.map(
      ({ name }: { name: string }) => name,
    );

    if (not) {
      should(collectionNames).not.containEql(collection);
    } else {
      should(collectionNames).containEql(collection);
    }
  },
);

Then(
  "I get mappings of collection {string}:{string}",
  async function (this: KuzzleWorld, index, collection) {
    this.props.result = await this.sdk.collection.getMapping(index, collection);
  },
);

Then("I refresh the collection", function (this: KuzzleWorld) {
  return this.sdk.collection.refresh(this.props.index, this.props.collection);
});
