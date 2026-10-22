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

import type { KuzzleRequest } from "../request";
import type { User } from "../../model/security/user";
import { Request } from "../request";
import { NativeController } from "./baseController";

/**
 * @class IndexController
 */
class IndexController extends NativeController {
  constructor() {
    super(["create", "delete", "exists", "list", "mDelete", "stats"]);
  }

  /**
   * Deletes multiple indexes or all indexes allow to user
   *
   * Body:
   *  - (optional) indexes: String[] - Index names to delete
   *
   * @param {Request} request
   *
   * @returns {Promise.<Object>}
   */
  async mDelete(request: KuzzleRequest) {
    const indexes = request.getBodyArray("indexes", []);

    const publicIndexes = await this.ask("core:storage:public:index:list");

    const filtered = publicIndexes.filter((index: string) =>
      indexes.includes(index),
    );

    const allowed = await this._allowedIndexes(request, filtered);

    const deleted = await this.ask(
      "core:storage:public:index:mDelete",
      allowed,
    );

    return { deleted };
  }

  /**
   * Creates an index
   *
   * @param {Request} request
   *
   * @returns {Promise}
   */
  async create(request: KuzzleRequest) {
    const index = request.getIndex();

    await this.ask("core:storage:public:index:create", index);
  }

  /**
   * Deletes the index and associated collections
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async delete(request: KuzzleRequest) {
    const index = request.getIndex();

    await this.ask("core:storage:public:index:delete", index);

    return { acknowledged: true };
  }

  /**
   * Lists indexes
   *
   */
  async list(request: KuzzleRequest) {
    const countCollection = request.getBoolean("countCollection");

    const indexes = await this.ask("core:storage:public:index:list");

    const response: {
      indexes: string[];
      collections?: { [index: string]: number };
    } = {
      indexes,
    };

    if (countCollection) {
      // Through a local: `response.collections` is optional, and the narrowing
      // the assignment gives does not reach inside the callbacks below.
      const counts: { [index: string]: number } = {};

      response.collections = counts;

      const promises = [];

      for (const index of indexes) {
        promises.push(
          this.ask("core:storage:public:collection:list", index).then(
            (collections) => {
              counts[index] = collections.length;
            },
          ),
        );
      }

      await Promise.all(promises);
    }

    return response;
  }

  /**
   * Tells if an index exists
   *
   * @param {Request} request
   * @returns {Promise.<boolean>}
   */
  exists(request: KuzzleRequest) {
    const index = request.getIndex();

    return this.ask("core:storage:public:index:exist", index);
  }

  /**
   * Returns storage stats
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async stats() {
    return this.ask("core:storage:public:index:stats");
  }

  /**
   * Returns a list of indexes allowed to be deleted by the user.
   *
   * Returns entire list of public indexes when called from EmbeddedSDK
   *
   * @param {Request} request
   * @param {String[]} publicIndexes - Public indexes list
   */
  _allowedIndexes(request: KuzzleRequest, publicIndexes: string[]) {
    const user: User | null = request.getUser();

    if (user === null) {
      return publicIndexes;
    }

    const allowedIndexes: string[] = [];

    const promises = publicIndexes.map((index) => {
      const deleteIndexRequest = new Request(
        { action: "delete", controller: "index", index },
        request.context,
      );

      return user.isActionAllowed(deleteIndexRequest).then((isAllowed) => {
        if (isAllowed) {
          allowedIndexes.push(index);
        }
      });
    });

    return Promise.all(promises).then(() => allowedIndexes);
  }
}

export = IndexController;
