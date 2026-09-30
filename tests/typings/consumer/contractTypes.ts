/**
 * The API contract types (ADR-0002 step 03): `kuzzle` now takes them from
 * kuzzle-types, the types-only package the server and the SDK share. Each is
 * still exported under its name, and identical — not merely assignable — both
 * to kuzzle-types' and to the one kuzzle-sdk (the installed version) exports:
 * a plugin mixing imports from "kuzzle" and "kuzzle-sdk" sees one type.
 */

import type * as Kuzzle from "kuzzle";
import type * as Sdk from "kuzzle-sdk";
import type * as Types from "kuzzle-types";

/** `true` only if A and B are identical types. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

function assert<T extends true>(): T | void {}

type Content = Kuzzle.KDocumentContent & { name: string };

assert<Equals<Kuzzle.ApiKey, Types.ApiKey>>();
assert<Equals<Kuzzle.ApiKey, Sdk.ApiKey>>();
assert<Equals<Kuzzle.ArgsDefault, Types.ArgsDefault>>();
assert<Equals<Kuzzle.ArgsDefault, Sdk.ArgsDefault>>();
assert<Equals<Kuzzle.BaseNotification, Types.BaseNotification>>();
assert<Equals<Kuzzle.BaseNotification, Sdk.BaseNotification>>();
assert<Equals<Kuzzle.BaseRequest, Types.BaseRequest>>();
assert<Equals<Kuzzle.BaseRequest, Sdk.BaseRequest>>();
assert<Equals<Kuzzle.CollectionMappings, Types.CollectionMappings>>();
assert<Equals<Kuzzle.CollectionMappings, Sdk.CollectionMappings>>();
assert<Equals<Kuzzle.DocumentContent, Types.DocumentContent>>();
assert<Equals<Kuzzle.DocumentContent, Sdk.DocumentContent>>();
assert<Equals<Kuzzle.DocumentMetadata, Types.DocumentMetadata>>();
assert<Equals<Kuzzle.DocumentMetadata, Sdk.DocumentMetadata>>();
assert<
  Equals<
    Kuzzle.DocumentNotification<Content>,
    Types.DocumentNotification<Content>
  >
>();
assert<
  Equals<
    Kuzzle.DocumentNotification<Content>,
    Sdk.DocumentNotification<Content>
  >
>();
assert<Equals<Kuzzle.HttpRoutes, Types.HttpRoutes>>();
assert<Equals<Kuzzle.HttpRoutes, Sdk.HttpRoutes>>();
assert<Equals<Kuzzle.JSONObject, Types.JSONObject>>();
assert<Equals<Kuzzle.JSONObject, Sdk.JSONObject>>();
assert<Equals<Kuzzle.KDocument<Content>, Types.KDocument<Content>>>();
assert<Equals<Kuzzle.KDocument<Content>, Sdk.KDocument<Content>>>();
assert<Equals<Kuzzle.KDocumentContent, Types.KDocumentContent>>();
assert<Equals<Kuzzle.KDocumentContent, Sdk.KDocumentContent>>();
assert<Equals<Kuzzle.KDocumentContentGeneric, Types.KDocumentContentGeneric>>();
assert<Equals<Kuzzle.KDocumentContentGeneric, Sdk.KDocumentContentGeneric>>();
assert<Equals<Kuzzle.KDocumentKuzzleInfo, Types.KDocumentKuzzleInfo>>();
assert<Equals<Kuzzle.KDocumentKuzzleInfo, Sdk.KDocumentKuzzleInfo>>();
assert<Equals<Kuzzle.KHit<Content>, Types.KHit<Content>>>();
assert<Equals<Kuzzle.KHit<Content>, Sdk.KHit<Content>>>();
assert<Equals<Kuzzle.MappingsProperties, Types.MappingsProperties>>();
assert<Equals<Kuzzle.MappingsProperties, Sdk.MappingsProperties>>();
assert<
  Equals<
    Kuzzle.mCreateOrReplaceRequest<Content>,
    Types.mCreateOrReplaceRequest<Content>
  >
>();
assert<
  Equals<
    Kuzzle.mCreateOrReplaceRequest<Content>,
    Sdk.mCreateOrReplaceRequest<Content>
  >
>();
assert<
  Equals<Kuzzle.mCreateOrReplaceResponse, Types.mCreateOrReplaceResponse>
>();
assert<Equals<Kuzzle.mCreateOrReplaceResponse, Sdk.mCreateOrReplaceResponse>>();
assert<Equals<Kuzzle.mCreateRequest<Content>, Types.mCreateRequest<Content>>>();
assert<Equals<Kuzzle.mCreateRequest<Content>, Sdk.mCreateRequest<Content>>>();
assert<Equals<Kuzzle.mCreateResponse, Types.mCreateResponse>>();
assert<Equals<Kuzzle.mCreateResponse, Sdk.mCreateResponse>>();
assert<Equals<Kuzzle.mDeleteRequest, Types.mDeleteRequest>>();
assert<Equals<Kuzzle.mDeleteRequest, Sdk.mDeleteRequest>>();
assert<Equals<Kuzzle.mDeleteResponse, Types.mDeleteResponse>>();
assert<Equals<Kuzzle.mDeleteResponse, Sdk.mDeleteResponse>>();
assert<
  Equals<Kuzzle.mReplaceRequest<Content>, Types.mReplaceRequest<Content>>
>();
assert<Equals<Kuzzle.mReplaceRequest<Content>, Sdk.mReplaceRequest<Content>>>();
assert<Equals<Kuzzle.mReplaceResponse, Types.mReplaceResponse>>();
assert<Equals<Kuzzle.mReplaceResponse, Sdk.mReplaceResponse>>();
assert<Equals<Kuzzle.mUpdateRequest<Content>, Types.mUpdateRequest<Content>>>();
assert<Equals<Kuzzle.mUpdateRequest<Content>, Sdk.mUpdateRequest<Content>>>();
assert<Equals<Kuzzle.mUpdateResponse, Types.mUpdateResponse>>();
assert<Equals<Kuzzle.mUpdateResponse, Sdk.mUpdateResponse>>();
assert<Equals<Kuzzle.mUpsertRequest<Content>, Types.mUpsertRequest<Content>>>();
assert<Equals<Kuzzle.mUpsertRequest<Content>, Sdk.mUpsertRequest<Content>>>();
assert<Equals<Kuzzle.mUpsertResponse, Types.mUpsertResponse>>();
assert<Equals<Kuzzle.mUpsertResponse, Sdk.mUpsertResponse>>();
assert<Equals<Kuzzle.Notification, Types.Notification>>();
assert<Equals<Kuzzle.Notification, Sdk.Notification>>();
assert<Equals<Kuzzle.NotificationType, Types.NotificationType>>();
assert<Equals<Kuzzle.NotificationType, Sdk.NotificationType>>();
assert<Equals<Kuzzle.ProfilePolicy, Types.ProfilePolicy>>();
assert<Equals<Kuzzle.ProfilePolicy, Sdk.ProfilePolicy>>();
assert<Equals<Kuzzle.RequestPayload, Types.RequestPayload>>();
assert<Equals<Kuzzle.RequestPayload, Sdk.RequestPayload>>();
assert<
  Equals<Kuzzle.ResponsePayload<Content>, Types.ResponsePayload<Content>>
>();
assert<Equals<Kuzzle.ResponsePayload<Content>, Sdk.ResponsePayload<Content>>>();
assert<Equals<Kuzzle.RoleRightsDefinition, Types.RoleRightsDefinition>>();
assert<Equals<Kuzzle.RoleRightsDefinition, Sdk.RoleRightsDefinition>>();
assert<Equals<Kuzzle.ServerNotification, Types.ServerNotification>>();
assert<Equals<Kuzzle.ServerNotification, Sdk.ServerNotification>>();
assert<Equals<Kuzzle.UserNotification, Types.UserNotification>>();
assert<Equals<Kuzzle.UserNotification, Sdk.UserNotification>>();
