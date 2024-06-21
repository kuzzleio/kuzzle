import { Client as ClientES7 } from "sdk-es7";
import { Client as ClientES8 } from "sdk-es8";

import { ES7 } from "./7/elasticsearch";
import { ES8 } from "./8/elasticsearch";

import Service from "../service";
import { storeScopeEnum } from "../../core/storage/storeScopeEnum";

export class Elasticsearch extends Service {
  public client: any;

  constructor(config: any, scope = storeScopeEnum.PUBLIC) {
    super("elasticsearch", config);

    global.kuzzle.log.info(`[ℹ] Elasticsearch configuration is set to major version : ${config.majorVersion}`);

    if (config.majorVersion === "7") {
      this.client = new ES7(config, scope);
    } else if (config.majorVersion === "8") {
      this.client = new ES8(config, scope);
    } else {
      throw new Error("Invalid Elasticsearch version.");
    }
  }

  static buildClient(config: any, version?: "7" | "8"): any {
    if (!version) {
      version = "7";
    }

    switch (version) {
      case "7":
        return new ClientES7(config);
      case "8":
        return new ClientES8(config);
      default:
        throw new Error("Invalid Elasticsearch version.");
    }
  }

  async _initSequence(): Promise<void> {
    await this.client._initSequence();
  }

  async init(): Promise<void> {
    await super.init();
  }
}
