/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

import {
  OpenApiPayloadsDefinitions,
  OpenApiDocumentCountComponent,
  OpenApiDocumentDeleteByQueryComponent,
  OpenApiDocumentDeleteComponent,
  OpenApiDocumentScrollComponent,
  OpenApiDocumentExistsComponent,
  OpenApiDocumentUpdateComponent,
  OpenApiDocumentReplaceComponent,
  OpenApiDocumentGetComponent,
  OpenApiDocumentCreateOrReplaceComponent,
  OpenApiDocumentCreateComponent,
  OpenApiDocumentValidateComponent,
  OpenApiSecurityUpsertUserComponent,
} from './components';
import { OpenApiDefinition } from '../../types/OpenApiDefinition';
import { version } from '../../../package.json';
import { generateOpenApi } from './openApiGenerator';

export class OpenApiManager {
  /* eslint-disable sort-keys */
  public kuzzleDefinition: OpenApiDefinition = {
    swagger: '2.0',
    info: {
      title: 'Kuzzle API',
      description: 'Kuzzle HTTP API definition',
      contact: {
        name: 'Kuzzle team',
        url: 'https://kuzzle.io',
        email: 'support@kuzzle.io',
        discord: 'http://join.discord.kuzzle.io'
      },
      license: {
        name: 'Apache 2',
        url: 'http://opensource.org/licenses/apache2.0'
      },
      version: version
    },
    externalDocs: {
      description: 'Kuzzle API Documentation',
      url: 'https://docs.kuzzle.io/core/2/api/'
    },
    servers: [
      {
        url: 'https://{baseUrl}:{port}',
        description: 'Kuzzle Base Url',
        variables: {
          baseUrl: { default: 'localhost' },
          port: { default: 7512 }
        },
      }
    ],
    tags: [],
    schemes: [ 'https', 'http' ],
    paths: {},
    components: {
      ...OpenApiPayloadsDefinitions,

      document: {
        ...OpenApiDocumentCountComponent,
        ...OpenApiDocumentDeleteByQueryComponent,
        ...OpenApiDocumentDeleteComponent,
        ...OpenApiDocumentScrollComponent,
        ...OpenApiDocumentExistsComponent,
        ...OpenApiDocumentUpdateComponent,
        ...OpenApiDocumentReplaceComponent,
        ...OpenApiDocumentGetComponent,
        ...OpenApiDocumentCreateOrReplaceComponent,
        ...OpenApiDocumentCreateComponent,
        ...OpenApiDocumentValidateComponent,
      },
      security: {
        ...OpenApiSecurityUpsertUserComponent,
      }
    }
  };
  /* eslint-enable sort-keys */

  public applicationDefinition: OpenApiDefinition;

  /**
   * @param applicationDefinition Application OpenApi definition
   * @param pluginsManager PluginsManager instance
   */
  constructor (applicationDefinition: OpenApiDefinition, kuzzleRoutes: any[], pluginsRoutes: any[]) {
    this.applicationDefinition = applicationDefinition;

    generateOpenApi(kuzzleRoutes, this.kuzzleDefinition);

    generateOpenApi(pluginsRoutes, this.applicationDefinition);

    this.registerAskEvents();
  }

  registerAskEvents () {
    global.kuzzle.onAsk('core:api:openapi:kuzzle', () => this.kuzzleDefinition);

    global.kuzzle.onAsk('core:api:openapi:app', () => this.applicationDefinition);
  }
}
