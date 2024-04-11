/**
 * @description one way syncing engine
 * - detect new and deleted records
 * - match fields from source to destination
 * @spec api design for detecting new and deleted records
 * - get two arrays of key fields (source and destination)
 * - returns two arrays (deleted, inserted) records.
 * @spec api design for field matching (update operation)
 * - get the source data as an arrays of objects.
 * - get field matching information for destination data (basically how to convert source data to destination)
 * - field matching array include
 * >- an objects for each field in destination data (each object includes fieldName and a function that gets the whole row as input and calculate and returns the destination data)
 */

/**
 * limit the data types
 */
type DataTypes = string | number | Date | null;

export type DataRecord = Record<string, DataTypes>;

export type FieldMatchingItem<ROW, DSTKEYS> = {
  fieldName: DSTKEYS;
  fn: (row: ROW) => DataTypes;
};

export type FieldMatchingInput<
  SRC extends DataRecord[],
  DSTKEYS extends DataRecord[]
> = {
  src: SRC;
  /** fieldMatchedData */
  matchInfo: FieldMatchingItem<SRC[number], keyof DSTKEYS[number]>[]; // SRC[number] to extract the type of the first element in the array
};

export type MatchFieldsFn = <
  SRC extends DataRecord[] = DataRecord[],
  // it gets an array of objects type, and extract the keys of the first object in the array
  DSTKEYS extends DataRecord[] = DataRecord[]
>(
  input: FieldMatchingInput<SRC, DSTKEYS>
) => Record<keyof DSTKEYS[number], DataTypes>[];

export const matchFields: MatchFieldsFn = ({ src, matchInfo }) => {
  return src.map((srcRow) => {
    const dstRow: Record<any, any> = {};
    matchInfo.forEach(({ fieldName, fn }) => {
      dstRow[fieldName] = fn(srcRow);
    });

    return dstRow;
  });
};

/**
 * Finds the changes between two sets of data records.
 *
 * @param {Object} params - The parameters for finding changes.
 * @param {DataRecord[]} params.targetData - The destination data records.
 * @param {DataRecord[]} params.srcData - The source data records.
 * @param {string[]} params.keys - The keys used to compare records.
 * @returns {Object} An object containing the inserted, deleted, and updated records.
 * @returns {DataRecord[]} .inserted - The records that were inserted.
 * @returns {DataRecord[]} .deleted - The records that were deleted.
 * @returns {UpdatedRowsResult} .updated - The records that were updated.
 *
 * @description
 * 1. We iterate over each record in `targetData` and generate a unique key by joining the values of the specified `keys` with an underscore (`_`). This key serves as a unique identifier for each record.
 *
 * 2. For each record in `targetData`, we check if a record with the same key exists in `srcData` using the `some` method. If no matching record is found in `srcData`, it means the record has been deleted, so we add it to the `deleted` array.
 *
 * 3. Similarly, we iterate over each record in `srcData` and generate a unique key.
 *
 * 4. For each record in `srcData`, we check if a record with the same key exists in `targetData`. If no matching record is found in `targetData`, it means the record has been inserted, so we add it to the `inserted` array.
 *
 * 5. For each record in `srcData`, we also check if a matching record exists in `targetData`. If a matching record is found, we compare the key-value pairs of the source record with the corresponding key-value pairs of the target record. If any key-value pair is different, we add an entry to the `fields` array of the `updated` object, specifying the field name, old value, and new value.
 *
 * 6. Finally, we return an object containing the `inserted`, `deleted`, and `updated` arrays.
 *
 * This implementation assumes that the combination of values specified by the `keys` array is unique for each record in both `targetData` and `srcData`. It compares the records based on these key values to determine which records have been inserted, deleted, or updated.
 */
export const findChanges = <T extends DataRecord[] = DataRecord[]>({
  targetData,
  srcData,
  keys,
}: {
  keys: string[];
  srcData: Record<keyof T[number], DataTypes>[];
  targetData: Record<keyof T[number], DataTypes>[];
}) => {
  const deleted = [];
  const inserted = [];
  const updated = [];

  // Find deleted records, look for the key-values in targetData that do not exist in srcData
  for (const dstRecord of targetData) {
    const dstKey = keys.map((key) => dstRecord[key]).join("_");
    const exists = srcData.some((srcRecord) => {
      const srcKey = keys.map((key) => srcRecord[key]).join("_");
      return srcKey === dstKey;
    });

    if (!exists) {
      deleted.push(dstRecord);
    }
  }

  // Find inserted records, look for the key-values in srcData that do not exist in targetData
  for (const srcRecord of srcData) {
    const srcKey = keys.map((key) => srcRecord[key]).join("_");
    const exists = targetData.some((dstRecord) => {
      const dstKey = keys.map((key) => dstRecord[key]).join("_");
      return dstKey === srcKey;
    });

    if (!exists) {
      inserted.push(srcRecord);
    }
  }

  // Find updated records and log the changes
  for (const srcRecord of srcData) {
    const srcKey = keys.map((key) => srcRecord[key]).join("_");
    const dstRecord = targetData.find((dstRecord) => {
      const dstKey = keys.map((key) => dstRecord[key]).join("_");
      return dstKey === srcKey;
    });

    if (dstRecord) {
      const fields: {
        fieldName: string;
        oldValue: DataTypes;
        newValue: DataTypes;
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
};

// TODO: add process changes function that takes the result of the findChanges function and apply the changes to the target data

// sample data
const srcData = [
  { id: 1, firstName: "Alice", yearsOld: 25 },
  { id: 2, firstName: "Bob", yearsOld: 30 },
  { id: 4, firstName: "Eve", yearsOld: 35 },
  { id: 5, firstName: "Frank", yearsOld: 40 },
];

const targetData = [
  { id: 1, name: "Alice", age: 25 },
  { id: 2, name: "Bob", age: 30 },
  { id: 3, name: "Charlie", age: 35 },
  { id: 4, name: "Eve", age: 40 },
];

const fieldMatchedData = matchFields<typeof srcData, typeof targetData>({
  src: srcData,
  matchInfo: [
    { fieldName: "id", fn: (row) => row.id },
    { fieldName: "name", fn: (row) => row.firstName },
    { fieldName: "age", fn: (row) => row.yearsOld },
  ],
});

const keys = ["id"];
const { inserted, deleted, updated } = findChanges<typeof targetData>({
  targetData,
  srcData: fieldMatchedData,
  keys,
});
console.log("inserted", inserted);
console.log("deleted", deleted);
console.log("updated", updated[0].row.id);
