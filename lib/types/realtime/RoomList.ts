/**
 * List of realtime rooms and the number of connections subscribing
 *
 * @example
 * {
 *   <index>: {
 *     <collection>: {
 *       <roomId>: <number of connections>
 *     }
 *   }
 * }
 *
 */
export type RoomList = {
  [index: string]: {
    [collection: string]: {
      [roomId: string]: number
    }
  }
};
