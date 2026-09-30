import { Then } from "@cucumber/cucumber";
import type KWorld from "../support/world";

Then(/^I wait ([\d.]*?)s$/, function (this: KWorld, time, callback) {
  setTimeout(function () {
    callback();
  }, time * 1000);
});
