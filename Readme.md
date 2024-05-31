Here's an updated version of your README file to include the new changes:

---

# One-Way Syncing Engine

This guide will walk you through the process of using the One-Way Syncing Engine to transform data, detect inserted, updated, and deleted records, and perform synchronization.

## Step 1: Prepare the Data

First, define the source and destination data arrays. In this example, we have `src` and `dst` arrays containing objects with specific properties.

```ts
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
```

## Step 2: Create the Sync Engine

Create an instance of the `SyncEngine` class, providing the necessary configuration options:

```ts
const engine = new SyncEngine<typeof src, typeof dst>({
  src,
  dst,
  mappings: [
    {
      dstField: "FullName",
      updateVal: (row) => `${row.company}-${row.id}`,
      insertVal: (row) => `${row.company}-${row.id}`,
      fn: async (row) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return `${row.firstName} ${row.lastName}`;
      },
    },
    { dstField: "id", isKey: true, srcField: "id" },
    { dstField: "company", isKey: true, fn: (row) => row.company },
    {
      dstField: "bio",
      compareFn: (src, dst) => src.bio.age === dst.bio.age,
      fn: (row) => ({ age: row.age }),
    },
  ],
  syncFns: {
    insertFn: async (row) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return row.id;
    },
    deleteFn: (row) => row.id,
    updateFn: async (row, fields) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return row.id;
    },
  },
});
```

The `mappings` option defines how the fields from the source data should be mapped to the destination data. The `syncFns` specifies the (Async or Sync) functions to be executed for inserting, deleting, and updating records.

## Step 3 (Optional): Map the Fields

Call the `mapFields()` method on the sync engine to map the fields from the source data to the destination data format.

```ts
const mappings = await engine.mapFields();
console.log("Mappings: ", JSON.stringify(mappings, null, 2));
```

This will output the mapped fields in JSON format.

## Step 4 (Optional): Get the Changes

Use the `getChanges()` method to retrieve the inserted, deleted, and updated records.

```ts
const changes = await engine.getChanges();
console.log("inserted:", changes.inserted);
console.log("updated:", changes.updated);
console.log("deleted:", changes.deleted);
```

The output will show the changes detected by the sync engine.

## Step 5 (Optional): Perform the Synchronization

Finally, call the `sync()` method to execute the synchronization process based on the detected changes.

```ts
const result = await engine.sync();
console.log("Result: ", JSON.stringify(result, null, 2));
```

The `sync()` method will run the insertFn, deleteFn, updateFn provided in syncFns and return the result of the synchronization, indicating the inserted, deleted, and updated records.

That's it! You have now successfully used the One-Way Syncing Engine to transform data, detect changes, and perform synchronization.

## Additional Tips

- Make sure to handle errors and edge cases appropriately.
- Customize the `syncFns` and `mappings` options to fit your specific use case.
- Use the `getChanges()` method to inspect the detected changes before performing the synchronization.

---
