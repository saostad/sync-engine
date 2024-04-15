# one way syncing engine

## detect new, updated and deleted records

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

const a = new SyncEngine<typeof src, typeof dst>({
  src,
  dst,
  keys,
  mappings: [
    { fieldName: "FullName", fn: (row) => `${row.firstName} ${row.lastName}` },
    { fieldName: "id", fn: (row) => row.id },
  ],
});

const mappings = a.mapFields();
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
const changes = a.getChanges();
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
