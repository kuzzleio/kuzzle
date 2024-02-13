import { ByteSize, ClusterNodesStats } from "sdk-es7/api/types";

export type InfoResult = {
  type: string;
  version: string;
  status?: string;
  lucene?: string;
  spaceUsed?: ByteSize;
  nodes?: ClusterNodesStats;
};

export type KRequestBody<T> = T & {
  _kuzzle_info?: {
    author: string;
    createdAt: number;
    updatedAt: number | null;
    updater: string | null;
  };
};

export interface JSONObject {
  [key: string]: any;
}

export type KImportError = {
  _id: string;
  status: string;
  _source?: JSONObject;
  error?: {
    reason: string;
    type: string;
  };
};

export type KRequestParams = {
  refresh?: boolean | "wait_for";
  timeout?: string;
  userId?: string;
  injectKuzzleMeta?: boolean;
  limits?: boolean;
  source?: boolean;
};
