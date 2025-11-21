export type Serializable = { _id: string };

export type Serialized<T extends Serializable> = {
  _id: T["_id"];
  _source: Record<string, any>;
};
