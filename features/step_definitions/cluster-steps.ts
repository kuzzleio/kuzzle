import { Then } from "@cucumber/cucumber";
import type KuzzleWorld from "../support/world";

Then("I target {string}", async function (this: KuzzleWorld, node: string) {
  const sdk = this.nodes[node];

  if (!sdk) {
    throw new Error(
      `No SDK for "${node}": the @cluster hook connects ${Object.keys(this.nodes).join(", ") || "nothing"}`,
    );
  }

  this.sdk = sdk;
});
