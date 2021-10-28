export type DumpConfiguration = {
  /**
   * Enable/disable information dump on crash or on errors
   * 
   * @default false
   */
  enabled: boolean

  history: {
  /**
  * Maximum number of core dumps to keep.
  *     Core dumps weight usually between 1 and 2GB,
  *     so make sure you have enough space to store
  *     the provided number of coredumps.
  * @default 3
  */
  coredump: number

  /**
  * Maximum number of reports directories
  * 
  * @default 5
  */
  reports: number
  }

  /**
   * Directory path where the dumps are stored
   * @default './dump/'
   */
  path: string

  /**
   * Location of the "gcore" binary
   * 
   * @default 'gcore'
   */
  gcore: string

  /**
   * Format used to generate dump names
   * (see http://momentjs.com for formats)
   * 
   * @default 'YYYYMMDD-HHmmss'
   */
  dateFormat: string

  /**
   * Creates a dump whenever an error belonging to the
   *  provided list is generated
   */
  handledErrors: {
  /**
  * Creates a dump whenever an error belonging to the
  * provided list is generated
  * 
  * @default true
  */
  enabled: boolean

  /**
  * List of error types triggering a dump
  * 
  * @default ["Error","RangeError","TypeError","KuzzleError","InternalError"]
  */
  whitelist: string[]

  /**
   * minInterval
   */
  minInterval: number
  }
}