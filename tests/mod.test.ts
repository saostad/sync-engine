import { SyncEngine } from "../mod.ts";
import testData from "./sample-data.json" with { type: "json" };
import { expect, test } from "vitest";

test("should compare source and destination arrays based on keys", async () => {
  const syncEngine = new SyncEngine<typeof testData.data.src, typeof testData.data.dst>({
    ...testData.data,
    mappings: [
      {
        dstField: "FullName",
        fn: async (row) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return `${row.firstName} ${row.lastName}`;
        },
      },
      { dstField: "id", isKey: true, srcField: "id" },
      { dstField: "company", isKey: true, fn: (row) => row.company },
      {
        dstField: "bio",
        compareFn: (src, dst)=>{
          return src.bio.age === dst.bio.age;
        },
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

  const mappings = await syncEngine.mapFields();
  expect(mappings).toEqual(testData.mapped);

  const changes = await syncEngine.getChanges();
  expect(changes.inserted).toEqual(testData.changes.inserted);
  expect(changes.deleted).toEqual(testData.changes.deleted);
  expect(changes.updated).toEqual(testData.changes.updated);

  // const syncResults = await syncEngine.sync();
  // expect(syncResults).toEqual({ inserts: [2], deletes: [3], updates: [4] });
});
