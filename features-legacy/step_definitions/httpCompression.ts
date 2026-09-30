import { Given } from "@cucumber/cucumber";
import { httpApi } from "../support/stepUtils";
import type KWorld from "../support/world";

Given(
  /^a request compressed with "([^"]*)"$/,
  function (this: KWorld, algorithm) {
    httpApi(this).encode(algorithm);
  },
);

Given(
  /^an expected response compressed with "([^"]*)"$/,
  function (this: KWorld, algorithm) {
    httpApi(this).decode(algorithm);
  },
);
