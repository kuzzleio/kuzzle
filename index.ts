export * from "./lib/core/backend";

export * from "./lib/types";

export * from "./lib/core/plugin/pluginContext";

export * from "./lib/core/shared/sdk/embeddedSdk";

export * from "./lib/api/request";

export * from "./lib/kerror/errors";

export * from "./lib/util/mutex";

export * from "./lib/util/distributedLock";

export * from "./lib/util/Inflector";

export { NameGenerator } from "./lib/util/name-generator";

// The server's own models behind `request.context`, under names that do not
// collide with the SDK's client classes (`User`) or with the `Token` interface
// — ADR-0002 step 02. Type-only: they are what a request carries, not
// something a plugin constructs.
export type {
  /**
   * The server-side user model: the type of `request.context.user` and of
   * `request.getUser()`. Not the SDK's client-side `User`, which is what
   * `app.sdk.security.*` returns.
   */
  User as KuzzleUser,
} from "./lib/model/security/user";
export type {
  /**
   * The server-side authentication token model: the type of
   * `request.context.token`. Its connections are tracked by the token manager,
   * not on the token, so unlike the `Token` interface it has no `connectionId`.
   */
  Token as KuzzleToken,
} from "./lib/model/security/token";

// The SDK names this package has always re-exported (it was `export * from
// "kuzzle-sdk"`), listed so that the SDK's next additions no longer become part
// of Kuzzle's API unannounced — ADR-0002 step 01
// (docs/adr-002/ADR-0002-own-api-contract-types.md). The typings gate asserts
// every one of them is still here (tests/typings/consumer/sdkReexports.ts).
//
// Values (classes and enums) — the SDK's client runtime, and the result classes
// `app.sdk.*` answers with:
export {
  AuthController,
  BaseController,
  BatchController,
  CollectionController,
  Document,
  DocumentController,
  DocumentSearchResult,
  /** @deprecated A client transport: import it from "kuzzle-sdk". */
  Http,
  IndexController,
  /** @deprecated The SDK's client. On the server, `app.sdk` is already one (an `EmbeddedSDK`); to open a client connection, import it from "kuzzle-sdk". */
  Kuzzle,
  /** @deprecated A client transport base class: import it from "kuzzle-sdk". */
  KuzzleAbstractProtocol,
  KuzzleEventEmitter,
  Observer,
  /** The SDK's client-side profile, as `app.sdk.security.*` returns it. */
  Profile,
  ProfileSearchResult,
  RealtimeController,
  RealtimeDocument,
  /** The SDK's client-side role, as `app.sdk.security.*` returns it. */
  Role,
  RoleSearchResult,
  ScopeOption,
  SearchResultBase,
  ServerController,
  SpecificationsSearchResult,
  /** The SDK's client-side user, as `app.sdk.security.*` returns it — not the type of `request.context.user`, which is `KuzzleUser`. */
  User,
  UserOption,
  UserSearchResult,
  /** @deprecated A client transport: import it from "kuzzle-sdk". */
  WebSocket,
} from "kuzzle-sdk";

// Types — the API contract, which ADR-0002 moves out of the SDK:
export type {
  ApiKey,
  ArgsAuthControllerCheckRights,
  ArgsAuthControllerCheckToken,
  ArgsAuthControllerCreateApiKey,
  ArgsAuthControllerCreateMyCredentials,
  ArgsAuthControllerCredentialsExist,
  ArgsAuthControllerDeleteApiKey,
  ArgsAuthControllerDeleteMyCredentials,
  ArgsAuthControllerGetCurrentUser,
  ArgsAuthControllerGetMyCredentials,
  ArgsAuthControllerGetMyRights,
  ArgsAuthControllerGetStrategies,
  ArgsAuthControllerLogin,
  ArgsAuthControllerLogout,
  ArgsAuthControllerRefreshToken,
  ArgsAuthControllerSearchApiKeys,
  ArgsAuthControllerUpdateMyCredentials,
  ArgsAuthControllerUpdateSelf,
  ArgsAuthControllerValidateMyCredentials,
  ArgsCollectionControllerCreate,
  ArgsCollectionControllerDelete,
  ArgsCollectionControllerDeleteSpecifications,
  ArgsCollectionControllerExists,
  ArgsCollectionControllerGetMapping,
  ArgsCollectionControllerGetSpecifications,
  ArgsCollectionControllerList,
  ArgsCollectionControllerRefresh,
  ArgsCollectionControllerSearchSpecifications,
  ArgsCollectionControllerTruncate,
  ArgsCollectionControllerUpdate,
  ArgsCollectionControllerUpdateMapping,
  ArgsCollectionControllerUpdateSpecifications,
  ArgsCollectionControllerValidateSpecifications,
  ArgsDefault,
  ArgsDocumentControllerCount,
  ArgsDocumentControllerCreate,
  ArgsDocumentControllerCreateOrReplace,
  ArgsDocumentControllerDelete,
  ArgsDocumentControllerDeleteByQuery,
  ArgsDocumentControllerDeleteFields,
  ArgsDocumentControllerExists,
  ArgsDocumentControllerGet,
  ArgsDocumentControllerMCreate,
  ArgsDocumentControllerMCreateOrReplace,
  ArgsDocumentControllerMDelete,
  ArgsDocumentControllerMGet,
  ArgsDocumentControllerMReplace,
  ArgsDocumentControllerMUpdate,
  ArgsDocumentControllerMUpsert,
  ArgsDocumentControllerReplace,
  ArgsDocumentControllerSearch,
  ArgsDocumentControllerUpdate,
  ArgsDocumentControllerUpdateByQuery,
  ArgsDocumentControllerUpsert,
  ArgsDocumentControllerValidate,
  ArgsIndexControllerCreate,
  ArgsIndexControllerDelete,
  ArgsIndexControllerExists,
  ArgsIndexControllerList,
  ArgsIndexControllerMDelete,
  ArgsIndexControllerStats,
  ArgsRealtimeControllerCount,
  ArgsRealtimeControllerPublish,
  ArgsRealtimeControllerSubscribe,
  ArgsRealtimeControllerUnsubscribe,
  ArgsServerControllerAdminExists,
  ArgsServerControllerGetAllStats,
  ArgsServerControllerGetConfig,
  ArgsServerControllerGetLastStats,
  ArgsServerControllerGetStats,
  ArgsServerControllerInfo,
  ArgsServerControllerNow,
  BaseNotification,
  BaseRequest,
  CollectionMappings,
  DocumentContent,
  DocumentHit,
  DocumentMetadata,
  DocumentNotification,
  HttpRoutes,
  KDocument,
  KDocumentContent,
  KDocumentContentGeneric,
  KDocumentKuzzleInfo,
  KHit,
  MappingsProperties,
  Notification,
  NotificationType,
  ObserverOptions,
  PrivateAndPublicSDKEvents,
  ProfilePolicy,
  PublicKuzzleEvents,
  RequestPayload,
  ResponsePayload,
  RoleRightsDefinition,
  SearchResult,
  ServerNotification,
  UpdateByQueryResponse,
  UserNotification,
  mCreateOrReplaceRequest,
  mCreateOrReplaceResponse,
  mCreateRequest,
  mCreateResponse,
  mDeleteRequest,
  mDeleteResponse,
  mReplaceRequest,
  mReplaceResponse,
  mUpdateRequest,
  mUpdateResponse,
  mUpsertRequest,
  mUpsertResponse,
} from "kuzzle-sdk";

export * from "./lib/core/shared/KoncordeWrapper";

export * from "./lib/core/shared/ObjectRepository";

export * from "./lib/core/shared/store";

export * from "./lib/core/cache/cacheDbEnum";

export * from "./lib/core/storage/storeScopeEnum";

export * from "./lib/service/storage/commons/queryTranslator";
