import { SyncEngine } from "../mod.ts";
import testData from "./sample-data.json" with { type: "json" };
import { expect, test } from "vitest";

test("should compare source and destination arrays based on keys", async () => {
  const syncEngine = new SyncEngine({
    ...testData.data,
    mappings: [
      {
        fieldName: "FullName",
        fn: (row) => `${row.firstName} ${row.lastName}`,
      },
      { fieldName: "id", fn: (row) => row.id },
    ],
    syncFns: {
      insertFn: async (row) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return row.id;
      },
      deleteFn: (row) => {
        return row.id;
      },
      updateFn: async (row, fields) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return row.id;
      },
    },
  });

  const mappings = syncEngine.mapFields();
  expect(mappings).toEqual(testData.mapped);

  const changes = syncEngine.getChanges();
  expect(changes.inserted).toEqual(testData.changes.inserted);
  expect(changes.deleted).toEqual(testData.changes.deleted);
  expect(changes.updated).toEqual(testData.changes.updated);

  const syncResults = await syncEngine.sync();
  expect(syncResults).toEqual({ inserts: [2], deletes: [3], updates: [4] });
});
