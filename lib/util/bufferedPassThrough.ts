/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import stream from "stream";

type Encoding = BufferEncoding | "buffer";

type ChunkData = Buffer | string;

type Chunk = {
  chunk: ChunkData;
  encoding: Encoding;
};

type Callback = (error?: Error) => void;

/**
 * This streams accumulate chunks data into a buffer until the amount of data is equal or exceed  the buffer size.
 * Then, it emits a single chunk with the accumulated data.
 *
 * This stream is useful when you want to reduce the amount of chunk produced by a stream.
 * This can helps reducing the number of syscall made by the stream consumer.
 */
export class BufferedPassThrough extends stream.Duplex {
  private bufferSize: number;
  private buffer: Buffer;
  private offset: number;

  constructor(options: stream.DuplexOptions = { highWaterMark: 8196 }) {
    super(options);
    this.bufferSize = options.highWaterMark;
    this.buffer = Buffer.alloc(options.highWaterMark);
    this.offset = 0;
  }

  /**
   * Writes a string or buffer to the internal buffer starting at the internal buffer offset.
   * Data will be copied from the given start to the end position.
   *
   * @param data
   * @param start Where to start copying/writing data from
   * @param end Where to end copying/writing data from
   * @param encoding Type of encoding to use
   * @returns How many bytes have been copied / written to the internal buffer.
   */
  private writeToBuffer(
    data: ChunkData,
    start: number,
    end: number,
    encoding: Encoding
  ): number {
    if (encoding === "buffer") {
      return (data as Buffer).copy(this.buffer, this.offset, start, end);
    }
    if (start === 0 && end === data.length) {
      return this.buffer.write(
        data as string,
        this.offset,
        end - start,
        encoding
      );
    }
    return this.buffer.write(
      (data as string).slice(start, end),
      this.offset,
      end - start,
      encoding
    );
  }

  private async writeChunks(chunks: Chunk[]): Promise<void> {
    for (const chunk of chunks) {
      await this.writeChunkData(chunk.chunk, chunk.encoding);
    }
  }

  /**
   * Writes a chunk of data to the internal buffer.
   * If the internal buffer is full, it will be pushed to the stream.
   * @param chunk
   * @param encoding
   */
  private async writeChunkData(
    chunk: ChunkData,
    encoding: Encoding
  ): Promise<void> {
    let chunkOffset = 0;

    while (chunkOffset < chunk.length) {
      const remainingChunkSize = chunk.length - chunkOffset;
      const remainingBufferSize = this.bufferSize - this.offset;

      // If the remaining bytes in the chunk exceed the remaining bytes in the internal buffer
      if (remainingChunkSize >= remainingBufferSize) {
        // Write as much as the remaining bytes as possible to the buffer  from t
        chunkOffset += this.writeToBuffer(
          chunk,
          chunkOffset,
          chunkOffset + remainingBufferSize,
          encoding
        );

        // Sends the whole buffer to the stream since it is full
        if (!this.push(this.buffer)) {
          await new Promise((res) => {
            this.once("_drained", res);
          });
        }

        this.offset = 0; // Reset the offset
      } else {
        // Write the whole chunk to the buffer
        const size = this.writeToBuffer(
          chunk,
          chunkOffset,
          chunk.length,
          encoding
        );
        // Increase the internal buffer offset
        this.offset += size;
        break;
      }
    }
  }

  /**
   * @override from stream.Duplex
   * Internal method called when data needs to be written.
   * @param chunkData
   * @param encoding
   * @param callback
   */
  _write(chunkData: ChunkData, encoding: Encoding, callback: Callback) {
    this.writeChunkData(chunkData, encoding).then(() => {
      callback();
    });
  }

  /**
   * @override from stream.Duplex
   * Internal method called when multiple chunks were stored and needs to be written.
   * @param chunks
   * @param callback
   */
  _writev(chunks: Chunk[], callback: Callback) {
    this.writeChunks(chunks).then(() => {
      callback();
    });
  }

  /**
   * @override from stream.Duplex
   * Internal method called when the stream is drained, to resume pushing data.
   * @param size
   */
  _read() {
    // Emits an internal _drained event when the internal buffer is drained.
    this.emit("_drained");
  }

  /**
   * @override from stream.Duplex
   * Internal method called when the stream is ended.
   * @param callback
   */
  _final(callback: Callback) {
    if (this.buffer && this.offset > 0) {
      // Push last bit of data
      this.push(this.buffer.slice(0, this.offset));
    }
    this.push(null); // Close the stream
    this.buffer = null;
    callback();
  }

  /**
   * @override from stream.Duplex
   * Internal method called when stream is destroyed.
   * @param err
   * @param callback
   */
  _destroy(err: Error, callback: Callback) {
    if (this.buffer && this.offset > 0) {
      // Push last bit of data
      this.push(this.buffer.slice(0, this.offset));
    }
    this.push(null); // Close the stream
    this.buffer = null;
    callback(err);
  }
}
