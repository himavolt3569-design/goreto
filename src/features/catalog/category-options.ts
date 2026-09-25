import type { SelectOption } from "@/components/ui/select";

export type CategoryOptionRow = { id: string; title: string; parentId: string | null };

/**
 * Categories as a two-level Select list: each top-level category followed by
 * its own subcategories (indented, with the parent as context). Sibling order
 * is the input order, so pass rows already sorted by sort_order/title.
 * A subcategory whose parent is missing is listed at the top level.
 */
export function categoryOptions(rows: readonly CategoryOptionRow[]): SelectOption[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const children = new Map<string, CategoryOptionRow[]>();
  const roots: CategoryOptionRow[] = [];

  for (const row of rows) {
    if (row.parentId && byId.has(row.parentId)) {
      const siblings = children.get(row.parentId) ?? [];
      siblings.push(row);
      children.set(row.parentId, siblings);
    } else {
      roots.push(row);
    }
  }

  return roots.flatMap((root) => [
    { value: root.id, label: root.title, depth: 0 as const },
    ...(children.get(root.id) ?? []).map((child) => ({
      value: child.id,
      label: child.title,
      depth: 1 as const,
      context: root.title,
    })),
  ]);
}
