import { Given } from "@cucumber/cucumber";
import type KuzzleWorld from "../support/world";

Given("an index {string}", async function (this: KuzzleWorld, index) {
  this.props.result = await this.sdk.index.create(index);

  this.props.index = index;
});
