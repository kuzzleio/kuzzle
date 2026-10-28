// Starts a Kuzzle Backend application tailored for development
import { Backend } from "./index";
import { exitOnFailure } from "./lib/kuzzle/exitOnFailure";

const app = new Backend("development-app");

app.start().catch((error) => {
  app.log.error(`Failed to start Kuzzle Backend application: ${error}`);
  exitOnFailure();
});
