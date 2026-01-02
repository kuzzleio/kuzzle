import { JSONObject } from "kuzzle-sdk";
import get from "lodash/get";
import isObject from "lodash/isObject";
import ndjson from "ndjson";
import stream from "node:stream";

import * as kerror from "../kerror";
import { BufferedPassThrough } from "./bufferedPassThrough";
import { HttpStream } from "../types";

/**
 * Flatten an object transform:
 * {
 *  title: "kuzzle",
 *  info : {
 *    tag: "news"
 *  }
 * }
 *
 * Into an object like:
 * {
 *  title: "kuzzle",
 *  info.tag: news
 * }
 *
 * @param {Object} target the object we have to flatten
 * @returns {Object} the flattened object
 */
export function flattenObject(target: JSONObject): JSONObject {
  const output = {};

  flattenStep(output, target);

  return output;
}

function flattenStep(
  output: JSONObject,
  object: JSONObject,
  prev: string | null = null,
): void {
  const keys = Object.keys(object);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = object[key];
    const newKey = prev ? prev + "." + key : key;

    if (Object.prototype.toString.call(value) === "[object Object]") {
      flattenStep(output, value, newKey);
      continue;
    }

    output[newKey] = value;
  }
}
/**
 * Extract fields from mapping by removing the properties from es mapping
 *
 * @param mapping
 * @returns
 */
export function extractMappingFields(mapping: JSONObject) {
  const newMapping: JSONObject = {};

  if (mapping.properties) {
    return extractMappingFields(mapping.properties);
  }

  for (const key of Object.keys(mapping)) {
    const property: JSONObject = mapping[key];

    if (isObject(property) && property.type) {
      newMapping[key] = property.type;
    } else if (isObject(property)) {
      newMapping[key] = extractMappingFields(property);
    }
  }

  return newMapping;
}

/**
 * An iteration-order-safe version of lodash.values
 *
 * @param object The object containing the values
 * @param fields The field names to pick in the right order
 * @returns The values in the same order as the fields
 * @see https://lodash.com/docs/4.17.15#values
 */
export function pickValues(object: any, fields: string[]): any[] {
  return fields.map((f) => formatValueForCSV(get(object, f)));
}

/**
 * Formats the value for correct CSV output, avoiding to return
 * values that would badly serialize in CSV.
 *
 * @param value The value to format
 * @returns The value or a string telling the value is not scalar
 */
function formatValueForCSV(value: any) {
  if (isObject(value)) {
    return "[OBJECT]";
  }

  return value;
}

abstract class AbstractDumper {
  protected collectionDir: string;

  protected abstract get fileExtension(): string;

  constructor(
    protected readonly index: string,
    protected readonly collection: string,
    protected readonly query: any = {},
    protected readonly writeStream: stream.Writable,
    protected readonly options: JSONObject = {
      fieldsName: {},
      scroll: "5s",
      separator: ",",
      size: 10,
    },
  ) {
    if (!writeStream) {
      throw kerror.get("api", "assert", "missing_argument", "writeStream");
    }
  }

  /**
   * One-shot call before the dump. Can be used to
   * perform setup operations before dumping.
   *
   * @returns void
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async setup() {}

  /**
   * One-shot call before iterating over the data. Can be
   * used to write the header of the dumped output.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async writeHeader() {}

  /**
   * You can put here the logic to write into the dump.
   *
   * @param data The data to be written to the dump (can be
   *             an item or anything else).
   */
  abstract writeLine(data: any): Promise<void>;

  /**
   * Iterative call, on each item in the collection to
   * be dumped. Useful to perform transformations on the data
   * before writing it in the dump. Usually, writeLine is
   * called by this hook.
   *
   * @param document The document to be written in a line of the dump.
   */
  abstract onResult(document: { _id: string; _source: any }): Promise<void>;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async tearDown() {}

  private async scroll(scrollId: string): Promise<JSONObject> {
    if (!scrollId) {
      return null;
    }

    try {
      return await global.kuzzle.ask(
        "core:storage:public:document:scroll",
        scrollId,
        { scrollTTL: this.options.scroll },
      );
    } catch {
      return null;
    }
  }

  /**
   * The loop that iterates over the documents of the collection and
   * calls all the other hooks.
   *
   * @returns a promise resolving when the dump is finished.
   */
  async dump() {
    const waitWrite: Promise<void> = new Promise((resolve, reject) =>
      this.writeStream ? this.writeStream.on("finish", resolve) : reject(),
    );

    this.writeStream.on("error", (error) => {
      throw error;
    });

    try {
      await this.setup();
      await this.writeHeader();

      let results = await global.kuzzle.ask(
        "core:storage:public:document:search",
        this.index,
        this.collection,
        this.query,
        {
          lang: this.options.lang,
          scroll: this.options.scroll,
          size: this.options.size,
        },
      );

      do {
        for (const hit of results.hits) {
          await this.onResult({
            _id: hit._id,
            _source: hit._source,
          });
        }
      } while ((results = await this.scroll(results.scrollId)));

      await this.tearDown();
    } catch (e) {
      this.writeStream.write(e.toString());
    }

    this.writeStream.end();

    return waitWrite;
  }
}

class JSONLDumper extends AbstractDumper {
  protected ndjsonStream = ndjson.stringify();

  async setup() {
    this.ndjsonStream.on("data", (line: string) => {
      this.writeStream.write(line);
    });
  }

  async writeHeader() {
    await this.writeLine({
      collection: this.collection,
      index: this.index,
      type: "collection",
    });
  }

  writeLine(content: any): Promise<void> {
    return new Promise((resolve) => {
      if (this.ndjsonStream.write(content)) {
        resolve();
      } else {
        this.ndjsonStream.once("drain", resolve);
      }
    });
  }

  onResult(document: { _id: string; _source: any }): Promise<void> {
    return this.writeLine({
      _id: document._id,
      body: document._source,
    });
  }

  protected get fileExtension() {
    return "jsonl";
  }
}

class CSVDumper extends AbstractDumper {
  constructor(
    index: string,
    collection: string,
    query: any = {},
    writeStream: stream.Writable,
    options: JSONObject,
    protected fields: string[],
  ) {
    super(index, collection, query, writeStream, options);
  }

  protected get fileExtension(): string {
    return "csv";
  }
  async setup() {
    if (!this.fields.length) {
      // If no field has been selected, then all fields are selected.
      const mappings = await global.kuzzle.ask(
        "core:storage:public:mappings:get",
        this.index,
        this.collection,
      );
      if (!mappings.properties) {
        return;
      }
      this.fields = Object.keys(
        flattenObject(extractMappingFields(mappings.properties)),
      );
    } else if (this.fields.includes("_id")) {
      // Delete '_id' from the selected fields, since IDs are
      // _always_ exported.
      this.fields.splice(this.fields.indexOf("_id"), 1);
    }
  }

  writeHeader() {
    const mappedFieldsName = ["_id", ...this.fields].map((field) => {
      return this.options.fieldsName[field] || field;
    });
    return this.writeLine(mappedFieldsName.join(this.options.separator));
  }

  writeLine(content: any): Promise<void> {
    return new Promise((resolve) => {
      if (this.writeStream.write(`${content}\n`)) {
        resolve();
      } else {
        this.writeStream.once("drain", resolve);
      }
    });
  }

  onResult(document: { _id: string; _source: any }): Promise<void> {
    const values = [document._id, ...pickValues(document._source, this.fields)];
    return this.writeLine(values.join(this.options.separator));
  }
}

export function dumpCollectionDocuments(
  index: string,
  collection: string,
  query: any = {},
  format = "jsonl",
  fields: string[] = [],
  options: JSONObject = {},
): HttpStream {
  let dumper: AbstractDumper;

  const writableStream = new BufferedPassThrough({ highWaterMark: 16384 });

  switch (format.toLowerCase()) {
    case "csv":
      dumper = new CSVDumper(
        index,
        collection,
        query,
        writableStream,
        options,
        fields,
      );
      dumper.dump();
      break;
    default:
      dumper = new JSONLDumper(
        index,
        collection,
        query,
        writableStream,
        options,
      );
      dumper.dump();
      break;
  }

  return new HttpStream(writableStream);
}
