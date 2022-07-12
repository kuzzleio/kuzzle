/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ApplicationManager, Backend } from "./index";
import { OpenApiDefinition } from "../../types";

export class BackendOpenApi extends ApplicationManager {
  /**
   * Application Open API definition
   */
  public definition: Partial<OpenApiDefinition>;

  constructor(application: Backend) {
    super(application);

    /* eslint-disable sort-keys */
    this.definition = {
      openapi: "3.0.0",
      info: {
        title: `${application.name} API`,
        description: `${application.name} HTTP API definition`,
        contact: {
          name: "Kuzzle team",
          url: "https://kuzzle.io",
          email: "support@kuzzle.io",
          discord: "http://join.discord.kuzzle.io",
        },
        license: {
          name: "Apache 2",
          url: "http://opensource.org/licenses/apache2.0",
        },
        version: application.version,
      },
      externalDocs: {
        description: "Kuzzle API Documentation",
        url: "https://docs.kuzzle.io/core/2/api/",
      },
      servers: [
        {
          url: "https://{baseUrl}:{port}",
          description: `${application.name} Base Url`,
          variables: {
            baseUrl: { default: "localhost" },
            port: { default: 7512 },
          },
        },
      ],
      tags: [],
      schemes: ["https", "http"],
      paths: {},
      components: {},
    };
    /* eslint-enable sort-keys */
  }
}
