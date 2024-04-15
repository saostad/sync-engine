import { SyncEngine } from "../class-sync.ts";
import testData from "./sample-data.json" with { type: "json" }
import { expect, test } from 'vitest'

test("should sync source and destination arrays based on keys", () => {
  
    const syncEngine = new SyncEngine({...testData.data, mappings: [
        { fieldName: "FullName", fn: (row) => `${row.firstName} ${row.lastName}` },
        { fieldName: "id", fn: (row) => row.id },
      ],});

    const changes = syncEngine.getChanges();

    expect(changes.inserted).toEqual(testData.changes.inserted);
    expect(changes.deleted).toEqual(testData.changes.deleted);
    expect(changes.updated).toEqual(testData.changes.updated);

});
