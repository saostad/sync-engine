export class SyncEngine<
  Src extends Record<any, any>[],
  Dst extends Record<any, any>[]
> {
  private src: Record<keyof Src[number], any>[];
  private dst: Record<keyof Dst[number], any>[];
  private keys: string[];
  private mappings: {
    fieldName: keyof Dst[number];
    fn: (row: Src[number]) => any;
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

  public mapFields(): Record<keyof Dst[number], any>[] {
    type MappedRow = Record<keyof Dst[number], any>;
    return this.src.map((srcRow) => {
      const dstRow: MappedRow = {} as MappedRow;
      this.mappings.forEach(({ fieldName, fn }) => {
        dstRow[fieldName] = fn(srcRow);
      });

      return dstRow;
    });
  }

  public getChanges(): {
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
  } {
    const deleted = [];
    const inserted = [];
    const updated = [];

    const mappedData = this.mapFields();

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

    // Find updated records and log the changes
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
            fields.push({
              fieldName: key,
              oldValue: dstRecord[key],
              newValue: value,
            });
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

  public async sync(): Promise<{
    inserts: any[] | null;
    deletes: any[] | null;
    updates: any[] | null;
  }> {
    const { inserted, deleted, updated } = this.getChanges();
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

// Usage

// const src = [
//   { id: 1, firstName: "John", lastName: "Doe" },
//   { id: 2, firstName: "Jane", lastName: "Diana" },
//   { id: 4, firstName: "Rid", lastName: "Lomba" },
// ];
// const dst = [
//   { id: 1, FullName: "John Doe" },
//   { id: 3, FullName: "Doe Risko" },
//   { id: 4, FullName: "Fids Almo" },
// ];

// const keys = ["id"];

// const a = new SyncEngine<typeof src, typeof dst>({
//   src,
//   dst,
//   keys,
//   mappings: [
//     { fieldName: "FullName", fn: (row) => `${row.firstName} ${row.lastName}` },
//     { fieldName: "id", fn: (row) => row.id },
//   ],
//   syncFns: {
//     insertFn: async (row) => {
//       await new Promise((resolve) => setTimeout(resolve, 1500));
//       return row.id;
//     },
//     deleteFn: (row) => {
//       return row.id;
//     },
//     updateFn: async (row, fields) => {
//       await new Promise((resolve) => setTimeout(resolve, 2000));
//       return row.id;
//     },
//   },
// });

// const mappings = a.mapFields();

// const changes = a.getChanges();

// a.sync().then((res) => {
//   console.log(res);
// });

// console.log(JSON.stringify(src, null, 2));
// console.log(JSON.stringify(dst, null, 2));
// console.log(JSON.stringify(mappings, null, 2));
// console.log(JSON.stringify(changes, null, 2));
