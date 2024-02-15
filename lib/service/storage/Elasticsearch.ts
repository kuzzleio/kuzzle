import { Client as ClientES7 } from "sdk-es7";
import { Client as ClientES8 } from "sdk-es8";

import { ES7 } from "./7/elasticsearch";
import { ES8 } from "./8/elasticsearch";

import Service from "../service";
import scopeEnum from "../../core/storage/storeScopeEnum";

export class Elasticsearch extends Service {
  private _client: any;

  get client() {
    return this._client;
  }

  constructor(config: any, scope = scopeEnum.PUBLIC) {
    super("elasticsearch", config);

    if (config.majorVersion === 7) {
      if (scope === scopeEnum.PUBLIC) {
        /* eslint-disable */
        console.warn(
          "Elasticsearch 7 is deprecated and will be removed in the next major release.",
        );
        console.warn("Please consider upgrading your Elasticsearch version.");
        console.warn("Update your configuration to set 'majorVersion' to 8.");
        console.warn("Under the key service.storageEngine.majorVersion");
        /* eslint-disable */
      }
      this._client = new ES7(config, scope);
    } else if (config.majorVersion === 8) {
      this._client = new ES8(config, scope);
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
        return new ClientES7(config);
      case 8:
        return new ClientES8(config);
      default:
        throw new Error("Invalid Elasticsearch version.");
    }
  }

  _initSequence() {
    return this._client._initSequence();
  }
}
