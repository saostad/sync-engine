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
  private mappings: Array<
    {
      dstField: keyof Dst[number];
      isKey?: boolean;
      /** custom function to compare rows */
      compareFn?: (src: Dst[number], dst: Dst[number]) => boolean;
      /** this function will generate value for specific fields that are not straightforward one-to-one mapping and need to put in different format, like setting lookup fields in dynamic360 web api. the value goes to return value of getChanges function, updated[number].overrides property. */
      updateVal?: (row: Dst[number]) => any;
      /** this function will generate value for specific fields that are not straightforward one-to-one mapping and need to put in different format, like setting lookup fields in dynamic360 web api. the value goes to return value of getChanges function, inserted[number].overrides property. */
      insertVal?: (row: Dst[number]) => any;
    } & (
      | {
          srcField: keyof Src[number];
        }
      | {
          /** function to generate dst value */
          fn: (row: Src[number]) => any | Promise<any>;
        }
    )
  > = [];
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
    src,
    mappings,
    syncFns,
  }: {
    src: Record<keyof Src[number], any>[];
    dst: Record<keyof Dst[number], any>[];
    mappings: Array<
      {
        dstField: keyof Dst[number];
        isKey?: boolean;
        /** if it returns false, it means we have a change */
        compareFn?: (src: Dst[number], dst: Dst[number]) => boolean;
        /** this function will generate value for specific fields that are not straightforward one-to-one mapping and need to put in different format, like setting lookup fields in dynamic360 web api. the value goes to return value of getChanges function, updated[number].overrides property. */
        updateVal?: (row: Dst[number]) => any;
        /** this function will generate value for specific fields that are not straightforward one-to-one mapping and need to put in different format, like setting lookup fields in dynamic360 web api. the value goes to return value of getChanges function, inserted[number].overrides property. */
        insertVal?: (row: Dst[number]) => any;
      } & (
        | {
            srcField: keyof Src[number];
          }
        | {
            /** function to generate dst value */
            fn: (row: Src[number]) => any | Promise<any>;
          }
      )
    >;
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
    this.keys = mappings
      .filter((m) => m.isKey)
      .map((m) => m.dstField as string);
    this.mappings = mappings;
    this.syncFns = syncFns || {};
  }

  public async mapFields(): Promise<Record<keyof Dst[number], any>[]> {
    type MappedRow = Record<keyof Dst[number], any>;

    const mappedData: MappedRow[] = [];
    for (const srcRow of this.src) {
      const dstRow: MappedRow = {} as MappedRow;

      for (const mapping of this.mappings) {
        if ("srcField" in mapping) {
          dstRow[mapping.dstField] = srcRow[mapping.srcField];
        } else {
          const { dstField, fn } = mapping;
          // check if fn async or not, then call it
          if (fn.constructor.name === "AsyncFunction") {
            dstRow[dstField] = await fn(srcRow);
          } else {
            dstRow[dstField] = fn(srcRow);
          }
        }
      }

      mappedData.push(dstRow);
    }
    return mappedData;
  }

  public async getChanges(): Promise<{
    inserted: {
      row: Record<keyof Dst[number], any>;
      overrides?: {
        fieldName: keyof Dst[number];
        value: any;
      }[];
    }[];
    deleted: Record<keyof Dst[number], any>[];
    updated: {
      row: Record<keyof Dst[number], any>;
      overrides?: {
        fieldName: keyof Dst[number];
        value: any;
      }[];
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
        const overrides: {
          fieldName: keyof Dst[number];
          value: any;
        }[] = [];

        for (const [key, value] of Object.entries(srcRecord)) {
          const insertValFn = this.mappings.find(
            (m) => m.dstField === key
          )?.insertVal;

          if (insertValFn) {
            const insertedValue = insertValFn(srcRecord);
            overrides.push({
              fieldName: key,
              value: insertedValue,
            });
          }
        }

        inserted.push({
          row: srcRecord,
          overrides: overrides.length > 0 ? overrides : undefined,
        });
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

        const overrides: {
          fieldName: keyof Dst[number];
          value: any;
        }[] = [];

        for (const [key, srcValue] of Object.entries(srcRecord)) {
          // check if compareFn exists
          const compareFn = this.mappings.find(
            (m) => "compareFn" in m && m.dstField === key
          )?.compareFn;

          if (compareFn) {
            if (!compareFn(srcRecord, dstRecord)) {
              fields.push({
                fieldName: key,
                oldValue: dstRecord[key],
                newValue: srcValue,
              });
            }
          } else if (dstRecord[key] !== srcValue) {
            fields.push({
              fieldName: key,
              oldValue: dstRecord[key],
              newValue: srcValue,
            });
          }

          const updateValFn = this.mappings.find(
            (m) => m.dstField === key
          )?.updateVal;

          if (updateValFn) {
            const updatedValue = updateValFn(srcRecord);
            overrides.push({
              fieldName: key,
              value: updatedValue,
            });
          }
        }

        if (fields.length > 0 || (fields.length > 0 && overrides.length > 0)) {
          updated.push({
            row: srcRecord,
            fields,
            overrides: overrides.length > 0 ? overrides : undefined,
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
        const { row, overrides } = record;
        const finalRow = { ...row };

        if (overrides) {
          for (const { fieldName, value } of overrides) {
            finalRow[fieldName] = value;
          }
        }

        if (this.syncFns.insertFn.constructor.name === "AsyncFunction") {
          funcs.push(this.syncFns.insertFn(finalRow));
        } else {
          funcs.push(Promise.resolve(this.syncFns.insertFn(finalRow)));
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
// const src = [
//   { id: 1, company: 1, firstName: "John", lastName: "Doe", age: null },
//   { id: 1, company: 2, firstName: "John", lastName: "Doe", age: null },
//   { id: 2, company: 1, firstName: "Jane", lastName: "Diana", age: null },
//   { id: 4, company: 1, firstName: "Rid", lastName: "Lomba", age: 25 },
//   { id: 5, company: 1, firstName: "Homa", lastName: "Shiri", age: 30 },
// ];
// const dst = [
//   { id: 1, company: 1, FullName: "John Doe", bio: { age: null } },
//   { id: 3, company: 1, FullName: "Doe Risko", bio: { age: 30 } },
//   { id: 4, company: 1, FullName: "Fids Almo", bio: { age: 26 } },
//   { id: 5, company: 1, FullName: "Homa Shiri", bio: { age: 30 } },
// ];

// const engine = new SyncEngine<typeof src, typeof dst>({
//   src,
//   dst,
//   mappings: [
//     {
//       dstField: "FullName",
//       updateVal: (row) => {
//         return `${row.company}-${row.id}`;
//       },
//       insertVal: (row) => {
//         return `${row.company}-${row.id}`;
//       },
//       fn: async (row) => {
//         await new Promise((resolve) => setTimeout(resolve, 100));
//         return `${row.firstName} ${row.lastName}`;
//       },
//     },
//     { dstField: "id", isKey: true, srcField: "id" },
//     { dstField: "company", isKey: true, fn: (row) => row.company },
//     {
//       dstField: "bio",
//       compareFn(src, dst) {
//         return src.bio.age === dst.bio.age;
//       },
//       fn: (row) => {
//         return {
//           age: row.age,
//         };
//       },
//     },
//   ],
//   syncFns: {
//     insertFn: async (row) => {
//       await new Promise((resolve) => setTimeout(resolve, 500));
//       return row.id;
//     },
//     deleteFn: (row) => {
//       return row.id;
//     },
//     updateFn: async (row, fields) => {
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       return row.id;
//     },
//   },
// });

// const mappings = await engine.mapFields();
// console.log(mappings);

// const changes = await engine.getChanges();
// // console.log(JSON.stringify(changes, null, 2));
// console.log("inserted:", changes.inserted);
// console.log("updated:", changes.updated);
// console.log("deleted:", changes.deleted);
