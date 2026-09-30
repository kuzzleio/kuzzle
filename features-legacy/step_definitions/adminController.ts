import { Given, When } from "@cucumber/cucumber";
import type KWorld from "../support/world";

Given("I load the mappings {string}", function (this: KWorld, mappings) {
  return this.api.loadMappings(JSON.parse(mappings));
});

When("I load the fixtures", function (this: KWorld, fixtures) {
  return this.api.loadFixtures(JSON.parse(fixtures));
});

When("I load the securities", function (this: KWorld, securities) {
  const parsed = JSON.parse(securities.replace(/#prefix#/g, this.idPrefix));
  return this.api.loadSecurities(parsed);
});

When("I reset public database", function (this: KWorld) {
  return this.api.adminResetDatabase();
});
