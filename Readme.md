# One way syncing engine

## Detect inserted, updated and deleted records

## Usage

```ts
const src = [
  { id: 1, firstName: "John", lastName: "Doe" },
  { id: 2, firstName: "Jane", lastName: "Diana" },
  { id: 4, firstName: "Rid", lastName: "Lomba" },
];
const dst = [
  { id: 1, FullName: "John Doe" },
  { id: 3, FullName: "Doe Risko" },
  { id: 4, FullName: "Fids Almo" },
];

const keys = ["id"];

const engine = new SyncEngine<typeof src, typeof dst>({
  src,
  dst,
  keys,
  mappings: [
    { fieldName: "FullName", fn: (row) => `${row.firstName} ${row.lastName}` },
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

const mappings = engine.mapFields();
console.log("Mappings: ", JSON.stringify(mappings, null, 2));
```

Output:

```json
"Mappings": [
    {
      "FullName": "John Doe",
      "id": 1
    },
    {
      "FullName": "Jane Diana",
      "id": 2
    },
    {
      "FullName": "Rid Lomba",
      "id": 4
    }
  ],
```

```ts
const changes = engine.getChanges();
console.log("Changes: ", JSON.stringify(changes, null, 2));
```

Output:

```json
"Changes": {
  "inserted": [
    {
      "FullName": "Jane Diana",
      "id": 2
    }
  ],
  "deleted": [
    {
      "id": 3,
      "FullName": "Doe Risko"
    }
  ],
  "updated": [
    {
      "row": {
        "FullName": "Rid Lomba",
        "id": 4
      },
      "fields": [
        {
          "fieldName": "FullName",
          "oldValue": "Fids Almo",
          "newValue": "Rid Lomba"
        }
      ]
    }
  ]
}
```

```ts
const result = await engine.sync();
console.log("Result: ", JSON.stringify(result, null, 2));
```

Output:

```json

"Result": {
  "inserted": [
    {
      "id": 2
    }
  ],
  "deleted": [
    {
      "id": 3
    }
  ],
  "updated": [
    {
      "id": 4
    }
  ]
}
```
