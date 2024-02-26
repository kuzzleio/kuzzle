import { Client as ClientES7 } from "sdk-es7";
import { Client as ClientES8 } from "sdk-es8";

import { ES7 } from "./7/elasticsearch";
import { ES8 } from "./8/elasticsearch";

import Service from "../service";
import scopeEnum from "../../core/storage/storeScopeEnum";

function printWarning() {
  /* eslint-disable */
  console.warn(
    "Elasticsearch 7 is deprecated and will be removed in the next major release."
  );
  console.warn("Please consider upgrading your Elasticsearch version.");
  console.warn("Update your configuration to set 'majorVersion' to 8.");
  console.warn("Under the key service.storageEngine.majorVersion");
  /* eslint-disable */
}

export class Elasticsearch extends Service {
  public client: any;

  constructor(config: any, scope = scopeEnum.PUBLIC) {
    super("elasticsearch", config);

    if (config.majorVersion === 7) {
      if (scope === scopeEnum.PUBLIC) {
        // printWarning();
      }
      this.client = new ES7(config, scope);
    } else if (config.majorVersion === 8) {
      this.client = new ES8(config, scope);
    } else {
      throw new Error("Invalid Elasticsearch version.");
    }
  }

  static buildClient(config: any, version?: 7 | 8): any {
    if (!version) {
      version = 7;
    }

    switch (version) {
      case 7:
        // printWarning();
        return new ClientES7(config);
      case 8:
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
