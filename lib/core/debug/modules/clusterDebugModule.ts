import { Session } from "inspector";
import { DebugModule } from "../../../types/DebugModule";
import * as kerror from "../../../kerror";

export class ClusterDebugModule extends DebugModule {
  constructor() {
    super("Cluster", {
      methods: ["preventNodeEviction"],
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async init(inspector: Session): Promise<void> {
    // Nothing to do (eslint complains if this method is not implemented)
  }

  async preventNodeEviction(params: { enable?: boolean }): Promise<void> {
    if (params.enable === undefined) {
      throw kerror.get("api", "assert", "missing_argument", "enable");
    }

    global.kuzzle.ask("cluster:node:preventEviction", params.enable);
  }

  async cleanup(): Promise<void> {
    // Ensure that the eviction is not prevented
    global.kuzzle.ask("cluster:node:preventEviction", false);
  }
}
