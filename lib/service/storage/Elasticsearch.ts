import { Client as ClientES7 } from "sdk-es7";
import { Client as ClientES8 } from "sdk-es8";

import { ES7 } from "./7/elasticsearch";
import { ES8 } from "./8/elasticsearch";

import Service from "../service";
import { storeScopeEnum } from "../../core/storage/storeScopeEnum";
import type { JSONObject } from "../../types/JSONObject";
import type { StorageEngineElasticsearch } from "../../types/config/storageEngine/StorageEngineElasticsearchConfiguration";

export class Elasticsearch extends Service<StorageEngineElasticsearch> {
  public client: ES7 | ES8;
  private readonly logger = global.kuzzle.log.child(
    "service:storage:elasticsearch",
  );

  constructor(
    config: StorageEngineElasticsearch,
    scope = storeScopeEnum.PUBLIC,
  ) {
    super("elasticsearch", config);

    if (config.majorVersion === "7") {
      this.client = new ES7(config, scope);
    } else if (config.majorVersion === "8") {
      this.client = new ES8(config, scope);
    } else {
      throw new Error("Invalid Elasticsearch version.");
    }
  }

  static buildClient(
    config: JSONObject,
    version?: "7" | "8",
  ): ClientES7 | ClientES8 {
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
