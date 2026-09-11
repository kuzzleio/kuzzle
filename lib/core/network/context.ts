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

import {
  BadRequestError,
  ExternalServiceError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalError as KuzzleInternalError,
  KuzzleError,
  NotFoundError,
  PartialError,
  PluginImplementationError,
  PreconditionError,
  ServiceUnavailableError,
  SizeLimitError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../../kerror/errors";
import { Request, RequestContext, RequestInput } from "../../api/request";
import createDebug from "../../util/debug";
import ClientConnection from "./clientConnection";
import ProtocolBase from "./protocols/protocol";

const debug = createDebug("kuzzle:network:protocols");

type LogLevel = "silly" | "debug" | "verbose" | "info" | "warn" | "error";

const logLevels: LogLevel[] = [
  "silly",
  "debug",
  "verbose",
  "info",
  "warn",
  "error",
];

/**
 * The object a protocol plugin is initialized with: the constructors and the
 * loggers it is allowed to reach, rather than the Kuzzle instance itself.
 */
class Context {
  public ClientConnection = ClientConnection;
  public debug = debug;
  public errors = {
    BadRequestError,
    ExternalServiceError,
    ForbiddenError,
    GatewayTimeoutError,
    InternalError: KuzzleInternalError,
    KuzzleError,
    NotFoundError,
    PartialError,
    PluginImplementationError,
    PreconditionError,
    ServiceUnavailableError,
    SizeLimitError,
    TooManyRequestsError,
    UnauthorizedError,
  };
  public Protocol = ProtocolBase;
  public Request = Request;
  public RequestContext = RequestContext;
  public RequestInput = RequestInput;

  public log: Record<LogLevel, (message: string, ...args: unknown[]) => void>;

  constructor() {
    this.log = {} as Record<
      LogLevel,
      (message: string, ...args: unknown[]) => void
    >;

    for (const type of logLevels) {
      this.log[type] = (message: string, ...args: unknown[]) =>
        global.kuzzle.log[type](message, ...args);
    }
  }
}

export = Context;
