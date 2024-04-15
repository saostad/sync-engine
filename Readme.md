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

const changes = a.getChanges();

console.log(JSON.stringify(src, null, 2));
console.log(JSON.stringify(dst, null, 2));
console.log(JSON.stringify(mappings, null, 2));
console.log(JSON.stringify(changes, null, 2));
```
