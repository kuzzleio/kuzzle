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

import AdminController = require("./adminController");
import AuthController = require("./authController");
import BulkController = require("./bulkController");
import ClusterController = require("./clusterController");
import CollectionController = require("./collectionController");
import DocumentController = require("./documentController");
import IndexController = require("./indexController");
import MemoryStorageController = require("./memoryStorageController");
import RealtimeController = require("./realtimeController");
import SecurityController = require("./securityController");
import ServerController = require("./serverController");
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
