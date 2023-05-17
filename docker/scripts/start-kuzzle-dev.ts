"use strict";

// Starts a Kuzzle Backend application tailored for development
import {
  Backend,
} from "../../index";


const app = new Backend("development-app");

app.start().catch((error) => {
  console.error(error);
  process.exit(1);
});
