const mutexes = new Map<string, boolean>();

export class AsyncMutex {
  private _resource: string;
  private _acquired: boolean;
  private _name: string;

  constructor (resource: string, name?: string) {
    this._resource = resource;
    this._acquired = false;
    this._name = name;
  }

  /**
   * Returns true if the resource is acquired by an other mutex.
   */
  get acquiredByOther (): boolean {
    return ! this._acquired && mutexes.get(this._resource);
  }

  /**
   * Return true if the resource is acquired by this mutex.
   */
  get acquired (): boolean {
    return this._acquired;
  }

  /**
   * Acquire the mutex.
   * @param wait If true, wait until the mutex is available.
   */
  async lock (wait = true): Promise<boolean> {
    if (this._acquired) {
      return true;
    }

    if (! wait && mutexes.get(this._resource)) {
      return false;
    }
      
    let resolve, reject;
    const promise = new Promise<boolean>((res, rej) => {
      resolve = res;
      reject = rej;
    })

    const callback = () => {
      if (mutexes.get(this._resource)) {
        setImmediate(callback);
        return;
      }

      this._acquired = true;
      mutexes.set(this._resource, true);
      resolve(true);
    }

    callback();

    return promise;
  }

  /**
   * Release the mutex.
   */
  unlock (): void {
    if (! this._acquired) {
      return;
    }
    mutexes.delete(this._resource);
    this._acquired = false;
  }
}