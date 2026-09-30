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

import AdminController from "./adminController";
import AuthController from "./authController";
import BulkController from "./bulkController";
import ClusterController from "./clusterController";
import CollectionController from "./collectionController";
import DocumentController from "./documentController";
import IndexController from "./indexController";
import MemoryStorageController from "./memoryStorageController";
import RealtimeController from "./realtimeController";
import SecurityController from "./securityController";
import ServerController from "./serverController";
import { DebugController } from "./debugController";

export = {
  AdminController,
  AuthController,
  BulkController,
  ClusterController,
  CollectionController,
  DebugController,
  DocumentController,
  IndexController,
  MemoryStorageController,
  RealtimeController,
  SecurityController,
  ServerController,
};
