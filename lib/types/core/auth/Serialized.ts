/**
 * What `formatProcessing` can serialize: anything carrying an id. The id is
 * nullable because the security models are — they carry `null` until they have
 * been stored (ADR-0001, TD-62) — and `Serialized` echoes back whichever it
 * has rather than widening it for everyone.
 */
export type Serializable = { _id: string | null };

export type Serialized<T extends Serializable> = {
  _id: T["_id"];
  _source: Record<string, any>;
};
