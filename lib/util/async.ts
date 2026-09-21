/*
 * Resolve promises with a limited concurrency number
 *
 * Replacement of Bluebird.map taken from :
 * https://gist.github.com/jcouyang/632709f30e12a7879a73e9e132c0d56b
 */
export function promiseAllN<T>(
  collection: Array<() => Promise<T>>,
  n = 100,
): Promise<T[]> {
  // An empty collection resolves to an empty list. The guard clause this
  // replaces read `return resolve([])`, which answers `undefined` — the
  // resolver's return value — rather than the promise it had just settled.
  if (collection.length === 0) {
    return Promise.resolve([]);
  }

  let i = 0;
  let jobsLeft = collection.length;
  const outcome: T[] = [];
  let rejected = false;

  // create a new promise and capture reference to resolve and reject to avoid nesting of code
  let resolve: (result: T[]) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;

  const pendingPromise = new Promise<T[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // execute the j'th thunk
  function runJob(j: number) {
    const job = collection[j];

    // `j` is always an index into `collection` — the bootstrap below and the
    // `i < collection.length` check are what keep it one.
    if (job === undefined) {
      return;
    }

    // `Reflect.apply` with the collection as the receiver: `collection[j]()`
    // passed the array as `this`, and hoisting the lookup out of the call is
    // how that gets dropped silently. Every caller hands arrows, so nothing
    // reads it — preserved rather than re-decided.
    Reflect.apply(job, collection, [])
      .then((result: T) => {
        if (rejected) {
          return; // no op!
        }

        jobsLeft--;
        outcome[j] = result;

        if (jobsLeft <= 0) {
          resolve(outcome);
        } else if (i < collection.length) {
          runJob(i);
          i++;
        } else {
          return; // nothing to do here.
        }
      })
      .catch((e) => {
        if (rejected) {
          return; // no op!
        }

        rejected = true;
        reject(e);
      });
  }

  // bootstrap, while handling cases where the length of the given array is smaller than maxConcurrent jobs
  while (i < Math.min(collection.length, n)) {
    runJob(i);
    i++;
  }

  return pendingPromise;
}
