// Should be in the SDK instead
export interface KuzzleDocument<T> {
  _id: string;

  _source: T;
}
