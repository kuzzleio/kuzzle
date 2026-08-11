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

import { JSONObject } from "kuzzle-sdk";

import type { KuzzleRequest } from "../../api/request";
import { sha256 } from "../../util/crypto";
import { has } from "../../util/safeObject";
import createDebug from "../../util/debug";
import * as kerror from "../../kerror";
import BaseModel from "./baseModel";
import type { User } from "../security/user";

const debug = createDebug("models:storage:apiKey");

interface ApiKeyCreateOptions {
  creatorId?: string | null;
  apiKeyId?: string | null;
  refresh?: boolean | string;
  bypassMaxTTL?: boolean;
}

/*
 * ApiKey.load(userId, id) intentionally takes an extra ownership argument that
 * BaseModel.load(id) does not, so the two static sides are deliberately not
 * structurally compatible. This is an accepted, pre-existing design divergence
 * (ApiKey scopes a load to its owner); the conversion changes no runtime
 * behaviour.
 */
// @ts-expect-error -- intentional static-signature divergence of load() vs BaseModel (TS2417)
class ApiKey extends BaseModel {
  declare userId: string;
  declare description: string;
  declare expiresAt: number;
  declare ttl: number | string;
  declare token: string;
  declare fingerprint: string;

  constructor(_source: JSONObject, _id: string | null = null) {
    super(_source, _id);
  }

  /**
   * @override
   */
  async _afterDelete(): Promise<void> {
    const token = await global.kuzzle.ask(
      "core:security:token:get",
      this.userId,
      this.token,
    );

    if (token) {
      await global.kuzzle.ask("core:security:token:delete", token);
    }
  }

  serialize({ includeToken = false }: { includeToken?: boolean } = {}): {
    _id: string | null;
    _source: JSONObject;
  } {
    const serialized = super.serialize();

    if (!includeToken && this.token) {
      delete serialized._source.token;
    }

    return serialized;
  }

  // Static public methods =====================================================

  /**
   * @override
   */
  static get collection(): string {
    return "api-keys";
  }

  /**
   * @override
   */
  static get fields(): string[] {
    return [
      "userId",
      "description",
      "expiresAt",
      "ttl",
      "token",
      "fingerprint",
    ];
  }

  /**
   * Creates a new API key for an user
   *
   * @param user
   * @param expiresIn - API key expiration date in ms format
   * @param description
   * @param options - creatorId (null), apiKeyId (null), refresh (null), bypassMaxTTL (false)
   */
  static async create(
    user: User,
    expiresIn: number | string,
    description: string,
    {
      creatorId = null,
      apiKeyId = null,
      refresh,
      bypassMaxTTL = false,
    }: ApiKeyCreateOptions = {},
  ): Promise<ApiKey> {
    const token = await global.kuzzle.ask("core:security:token:create", user, {
      bypassMaxTTL,
      expiresIn,
      type: "apiKey",
    });

    const fingerprint = sha256(token.jwt);
    const apiKey = new ApiKey(
      {
        description,
        expiresAt: token.expiresAt,
        fingerprint,
        ttl: token.ttl,
        userId: user._id,
      },
      apiKeyId || fingerprint,
    );
    await apiKey.save({ refresh, userId: creatorId });

    apiKey.token = token.jwt;

    return apiKey;
  }

  /**
   * Loads an user API key from the database
   *
   * @param userId - User ID
   * @param id - API key ID
   */
  static async load(userId: string, id: string): Promise<ApiKey> {
    const apiKey = (await super.load(id)) as ApiKey;

    if (userId !== apiKey.userId) {
      throw kerror.get("services", "storage", "not_found", id, {
        message: `ApiKey "${id}" not found for user "${userId}".`,
      });
    }

    return apiKey;
  }

  /**
   * Loads an user API key from the database by its fingerprint
   *
   * @param userId - User ID
   * @param fingerprint - API key fingerprint
   */
  static async loadByFingerprint(
    userId: string,
    fingerprint: string,
  ): Promise<ApiKey> {
    const [apiKey] = await this.search(
      {
        query: {
          bool: {
            filter: { term: { fingerprint } },
            must: { term: { userId } },
          },
        },
      },
      { size: 1 },
    );

    if (!apiKey) {
      throw kerror.get("services", "storage", "not_found", fingerprint, {
        message: `ApiKey with fingerprint "${fingerprint}" not found for user "${userId}".`,
      });
    }

    return apiKey as ApiKey;
  }

  /**
   * Loads a user's API key from a request, identified by its `_id`, its
   * clear-text `key` or its `fingerprint` (in that order of precedence).
   *
   * @param userId - User ID
   * @param request - Request carrying the `_id`, `key` or `fingerprint` argument
   */
  static async loadFromRequest(
    userId: string,
    request: KuzzleRequest,
  ): Promise<ApiKey> {
    const apiKeyId = request.getId({ ifMissing: "ignore" });

    if (apiKeyId) {
      return this.load(userId, apiKeyId);
    }

    if (has(request.input.args, "key")) {
      return this.loadByFingerprint(userId, sha256(request.getString("key")));
    }

    if (has(request.input.args, "fingerprint")) {
      return this.loadByFingerprint(userId, request.getString("fingerprint"));
    }

    throw kerror.get(
      "api",
      "assert",
      "missing_argument",
      "_id, key or fingerprint",
    );
  }

  /**
   * Deletes API keys for an user
   *
   * @param user
   * @param options - refresh (null)
   */
  static deleteByUser(
    user: User,
    { refresh }: { refresh?: boolean | string } = {},
  ): Promise<void> {
    debug("Delete ApiKeys for user %a", user);
    return this.deleteByQuery({ term: { userId: user._id } }, { refresh });
  }
}

BaseModel.register(ApiKey);

export = ApiKey;
