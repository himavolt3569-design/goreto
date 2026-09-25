/*
 * Options -> variant rows for the product editor. Regenerating keeps every
 * existing row whose option combination still exists (with its id, SKU, price
 * and stock) and adds rows only for new combinations.
 */

export const MAX_OPTIONS = 3;
export const MAX_OPTION_VALUES = 20;
export const MAX_VARIANTS = 100;

export type MatrixOption = { name: string; values: { value: string }[] };

/** Every combination of option values, in option order. No options -> one empty combination. */
export function combinations(options: readonly MatrixOption[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (rows, option) => rows.flatMap((row) => option.values.map((value) => ({ ...row, [option.name]: value.value }))),
    [{}],
  );
}

export function combinationCount(options: readonly MatrixOption[]): number {
  return options.reduce((count, option) => count * option.values.length, 1);
}

/** Order-independent identity of a combination. */
export function combinationKey(optionValues: Readonly<Record<string, string>>): string {
  return JSON.stringify(Object.keys(optionValues).sort().map((name) => [name, optionValues[name]]));
}

export type MergeResult<Row> = { rows: Row[]; removed: Row[] };

/**
 * New variant list for `options`: existing rows keep their place in matrix
 * order; `create` builds rows for new combinations. Rows whose combination no
 * longer exists are returned as `removed`.
 */
export function mergeVariants<Row extends { optionValues: Record<string, string> }>(
  options: readonly MatrixOption[],
  current: readonly Row[],
  create: (optionValues: Record<string, string>) => Row,
): MergeResult<Row> {
  const byKey = new Map(current.map((row) => [combinationKey(row.optionValues), row]));
  const rows = combinations(options).map((optionValues) => {
    const key = combinationKey(optionValues);
    const existing = byKey.get(key);
    byKey.delete(key);
    return existing ?? create(optionValues);
  });
  return { rows, removed: [...byKey.values()] };
}

/** True when the rows are exactly the options' combinations (in any order). */
export function variantsMatchOptions(options: readonly MatrixOption[], rows: readonly { optionValues: Record<string, string> }[]): boolean {
  const expected = new Set(combinations(options).map(combinationKey));
  const actual = rows.map((row) => combinationKey(row.optionValues));
  return actual.every((key) => expected.has(key)) && new Set(actual).size === actual.length;
}

/** Renames an option key in each row's option values (after staff rename an option). */
export function renameOptionKey<Row extends { optionValues: Record<string, string> }>(rows: readonly Row[], from: string, to: string): Row[] {
  if (from === to) return [...rows];
  return rows.map((row) => {
    if (!(from in row.optionValues)) return row;
    const { [from]: value, ...rest } = row.optionValues;
    return { ...row, optionValues: { ...rest, [to]: value! } };
  });
}
