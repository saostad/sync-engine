/**
 * @module SyncEngine
 * @description SyncEngine is a class that helps you sync data between two arrays of objects.
 */
export class SyncEngine<
  Src extends Record<any, any>[],
  Dst extends Record<any, any>[]
> {
  private src: Record<keyof Src[number], any>[];
  private dst: Record<keyof Dst[number], any>[];
  private keys: string[];
  private mappings: {
    fieldName: keyof Dst[number];
    /** sync or async function */
    fn: (row: Src[number]) => any | Promise<any>;
  }[] = [];
  private syncFns: {
    insertFn?: (row: Record<keyof Dst[number], any>) => void | Promise<void>;
    deleteFn?: (row: Record<keyof Dst[number], any>) => void | Promise<void>;
    updateFn?: (
      row: Record<keyof Dst[number], any>,
      fields: {
        fieldName: keyof Dst[number];
        oldValue: any;
        newValue: any;
      }[]
    ) => void | Promise<void>;
  } = {};

  constructor({
    dst,
    keys,
    src,
    mappings,
    syncFns,
  }: {
    src: Record<keyof Src[number], any>[];
    dst: Record<keyof Dst[number], any>[];
    keys: string[];
    mappings: Array<{
      fieldName: keyof Dst[number];
      fn: (row: Src[number]) => any;
    }>;
    syncFns?: {
      insertFn?: (row: Record<keyof Dst[number], any>) => any | Promise<any>;
      deleteFn?: (row: Record<keyof Dst[number], any>) => any | Promise<any>;
      updateFn?: (
        row: Record<keyof Dst[number], any>,
        fields: {
          fieldName: keyof Dst[number];
          oldValue: any;
          newValue: any;
        }[]
      ) => any | Promise<any>;
    };
  }) {
    this.src = src;
    this.dst = dst;
    this.keys = keys;
    this.mappings = mappings;
    this.syncFns = syncFns || {};
  }

  public async mapFields(): Promise<Record<keyof Dst[number], any>[]> {
    type MappedRow = Record<keyof Dst[number], any>;

    const mappedData: MappedRow[] = [];
    for (const srcRow of this.src) {
      const dstRow: MappedRow = {} as MappedRow;

      for (const { fieldName, fn } of this.mappings) {
        // check if fn async or not, then call it
        if (fn.constructor.name === "AsyncFunction") {
          dstRow[fieldName] = await fn(srcRow);
        } else {
          dstRow[fieldName] = fn(srcRow);
        }
      }

      mappedData.push(dstRow);
    }
    return mappedData;
  }

  public async getChanges(): Promise<{
    inserted: Record<keyof Dst[number], any>[];
    deleted: Record<keyof Dst[number], any>[];
    updated: {
      row: Record<keyof Dst[number], any>;
      fields: {
        fieldName: keyof Dst[number];
        oldValue: any;
        newValue: any;
      }[];
    }[];
  }> {
    const deleted = [];
    const inserted = [];
    const updated = [];

    const mappedData = await this.mapFields();

    // Find deleted records, look for the key-values in this.dst that do not exist in mappedData
    for (const dstRecord of this.dst) {
      const dstKey = this.keys.map((key) => dstRecord[key]).join("_");
      const exists = mappedData.some((srcRecord) => {
        const srcKey = this.keys.map((key) => srcRecord[key]).join("_");
        return srcKey === dstKey;
      });

      if (!exists) {
        deleted.push(dstRecord);
      }
    }

    // Find inserted records, look for the key-values in mappedData that do not exist in this.dst
    for (const srcRecord of mappedData) {
      const srcKey = this.keys.map((key) => srcRecord[key]).join("_");
      const exists = this.dst.some((dstRecord) => {
        const dstKey = this.keys.map((key) => dstRecord[key]).join("_");
        return dstKey === srcKey;
      });

      if (!exists) {
        inserted.push(srcRecord);
      }
    }

    // Find updated records
    for (const srcRecord of mappedData) {
      const srcKey = this.keys.map((key) => srcRecord[key]).join("_");
      const dstRecord = this.dst.find((dstRecord) => {
        const dstKey = this.keys.map((key) => dstRecord[key]).join("_");
        return dstKey === srcKey;
      });

      if (dstRecord) {
        const fields: {
          fieldName: keyof Dst[number];
          oldValue: any;
          newValue: any;
        }[] = [];

        for (const [key, value] of Object.entries(srcRecord)) {
          if (dstRecord[key] !== value) {
            // check if value is an object, use _shallowEqual to compare
            if (typeof value === "object") {
              if (!this._shallowEqual(value, dstRecord[key])) {
                fields.push({
                  fieldName: key,
                  oldValue: dstRecord[key],
                  newValue: value,
                });
              }
            } else {
              fields.push({
                fieldName: key,
                oldValue: dstRecord[key],
                newValue: value,
              });
            }
          }
        }

        if (fields.length > 0) {
          updated.push({
            row: srcRecord,
            fields,
          });
        }
      }
    }

    return { inserted, deleted, updated };
  }

  // to compare two objects
  private _shallowEqual(src: Record<any, any>, dst: Record<any, any>) {
    if (typeof src !== "object" || typeof dst !== "object") {
      return false;
    }
    for (let key in src) {
      if (src[key] !== dst[key]) {
        return false;
      }
    }
    return true;
  }

  public async sync(): Promise<{
    inserts: any[] | null;
    deletes: any[] | null;
    updates: any[] | null;
  }> {
    const { inserted, deleted, updated } = await this.getChanges();
    const results: {
      inserts: any[] | null;
      deletes: any[] | null;
      updates: any[] | null;
    } = {
      inserts: null,
      deletes: null,
      updates: null,
    };

    if (this.syncFns.insertFn) {
      const funcs = [];
      for (const record of inserted) {
        // check if insertFn async or not
        if (this.syncFns.constructor.name === "AsyncFunction") {
          funcs.push(this.syncFns.insertFn(record));
        } else {
          funcs.push(Promise.resolve(this.syncFns.insertFn(record)));
        }
      }
      if (funcs.length > 0) {
        results.inserts = await Promise.all(funcs);
      }
    }

    if (this.syncFns.deleteFn) {
      const funcs = [];
      for (const record of deleted) {
        if (this.syncFns.constructor.name === "AsyncFunction") {
          funcs.push(this.syncFns.deleteFn(record));
        } else {
          funcs.push(Promise.resolve(this.syncFns.deleteFn(record)));
        }
      }
      if (funcs.length > 0) {
        results.deletes = await Promise.all(funcs);
      }
    }

    if (this.syncFns.updateFn) {
      const funcs = [];
      for (const { row, fields } of updated) {
        if (this.syncFns.constructor.name === "AsyncFunction") {
          funcs.push(this.syncFns.updateFn(row, fields));
        } else {
          funcs.push(Promise.resolve(this.syncFns.updateFn(row, fields)));
        }
      }
      if (funcs.length > 0) {
        results.updates = await Promise.all(funcs);
      }
    }

    return results;
  }
}

// sample usage
const src = [
  { id: 1, company: 1, firstName: "John", lastName: "Doe", age: null },
  { id: 1, company: 2, firstName: "John", lastName: "Doe", age: null },
  { id: 2, company: 1, firstName: "Jane", lastName: "Diana", age: null },
  { id: 4, company: 1, firstName: "Rid", lastName: "Lomba", age: 25 },
  { id: 5, company: 1, firstName: "Homa", lastName: "Shiri", age: 30 },
];
const dst = [
  { id: 1, company: 1, FullName: "John Doe", bio: { age: null } },
  { id: 3, company: 1, FullName: "Doe Risko", bio: { age: 30 } },
  { id: 4, company: 1, FullName: "Fids Almo", bio: { age: 26 } },
  { id: 5, company: 1, FullName: "Homa Shiri", bio: { age: 30 } },
];
const keys = ["id", "company"];

const engine = new SyncEngine<typeof src, typeof dst>({
  src,
  dst,
  keys,
  mappings: [
    {
      fieldName: "FullName",
      fn: async (row) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return `${row.firstName} ${row.lastName}`;
      },
    },
    { fieldName: "id", fn: (row) => row.id },
    { fieldName: "company", fn: (row) => row.company },
    {
      fieldName: "bio",
      fn: (row) => {
        return {
          age: row.age,
        };
      },
    },
  ],
  syncFns: {
    insertFn: async (row) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return row.id;
    },
    deleteFn: (row) => {
      return row.id;
    },
    updateFn: async (row, fields) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return row.id;
    },
  },
});

const mappings = await engine.mapFields();
console.log(mappings);

const changes = await engine.getChanges();
console.log(JSON.stringify(changes, null, 2));
