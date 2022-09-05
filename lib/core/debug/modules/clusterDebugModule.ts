import { Session } from "inspector";
import { DebugModule } from "../../../types/DebugModule";
import * as kerror from "../../../kerror";

export class ClusterDebugModule extends DebugModule {
  constructor() {
    super("Cluster", {
      methods: ["preventNodeEviction"]
    });
  }

  async init(inspector: Session): Promise<void> {
    
  }

  async preventNodeEviction(params: { evictionPrevented?: boolean }): Promise<void> {
    if (params.evictionPrevented === undefined) {
      throw kerror.get("api", "assert", "missing_argument", "evictionPrevented");
    }

    global.kuzzle.ask("cluster:node:preventEviction", params.evictionPrevented);
  }
  
  async cleanup(): Promise<void> {
    // Ensure that the eviction is not prevented
    global.kuzzle.ask("cluster:node:preventEviction", false);
  }

}