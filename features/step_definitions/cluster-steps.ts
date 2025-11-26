import should from "should";
import { Then } from "@cucumber/cucumber";

Then("I target {string}", async function (node) {
  should(this).have.property(node);

  this.sdk = this[node];
});
