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

## Step 2: Define the Keys

Specify the keys that uniquely identify each record in the arrays. In this example, we use the `"id"` and `"company"` property as the key.

```ts
const keys = ["id", "company"];
```

## Step 3: Create the Sync Engine

Create an instance of the `SyncEngine` class, providing the necessary configuration options:

```ts
const engine = new SyncEngine<typeof src, typeof dst>({
  src,
  dst,
  keys,
  mappings: [
    {
      fieldName: "FullName",
      // Async function to map the FullName field
      fn: async (row) => {
        // await some async operation
        return Promise.resolve(`${row.firstName} ${row.lastName}`);
      },
    },
    { fieldName: "id", fn: (row) => row.id },
    { fieldName: "company", fn: (row) => row.company },
    { fieldName: "bio", fn: (row) => ({ age: row.age }) }, // Nested field
  ],
  // Optional
  syncFns: {
    // Async function to insert a record
    insertFn: async (row) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return row.id;
    },
    // Sync function to delete a record
    deleteFn: (row) => {
      return row.id;
    },
    updateFn: async (row, fields) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return row.id;
    },
  },
});
```

The `mappings` option defines how the fields from the source data should be mapped to the destination data. The `syncFns` are optional and specifies the (Async or Sync) functions to be executed for inserting, deleting, and updating records.

## Step 4 (Optional): Map the Fields

Call the `mapFields()` method on the sync engine to map the fields from the source data to the destination data format.

```ts
const mappings = await engine.mapFields();
console.log("Mappings: ", JSON.stringify(mappings, null, 2));
```

This will output the mapped fields in JSON format.

## Step 5 (Optional): Get the Changes

Use the `getChanges()` method to retrieve the inserted, deleted, and updated records.

```ts
const changes = await engine.getChanges();
console.log("Changes: ", JSON.stringify(changes, null, 2));
```

The output will show the changes detected by the sync engine.

## Step 6 (Optional): Perform the Synchronization

Finally, call the `sync()` method to execute the synchronization process based on the detected changes.

```ts
const result = await engine.sync();
console.log("Result: ", JSON.stringify(result, null, 2));
```

The `sync()` method will return the result of the synchronization, indicating the inserted, deleted, and updated records.

That's it! You have now successfully used the One-Way Syncing Engine to transform data, detect changes, and perform synchronization.

## Additional Tips

- Make sure to handle errors and edge cases appropriately.
- Customize the syncFns and mappings options to fit your specific use case.
- Use the getChanges() method to inspect the detected changes before performing the synchronization.
