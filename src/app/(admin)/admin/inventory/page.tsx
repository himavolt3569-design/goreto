import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, FilterBar, FilterField, LinkTabs, PageHeader, Pagination, Panel, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { StockAdjustForm } from "@/components/admin/stock-adjust-form";
import { ActivePill, StockPill } from "@/components/admin/status-pills";
import { PackageIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, humanize } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import { fetchInventory, type StockState } from "@/features/admin/queries/catalog";
import { fetchAttentionCounts } from "@/features/admin/queries/dashboard";
import { pageNumber, pickEnum } from "@/features/admin/queries/shared";
import { sanitizeSearch } from "@/features/admin/search-input";
import { hrefWith } from "@/features/admin/url";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Inventory" };

const STOCK_STATES: readonly StockState[] = ["in_stock", "low_stock", "sold_out"];

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const profile = await requireAdminAccess("catalog.read");
  const params = await searchParams;
  const q = sanitizeSearch(params.q);
  const stock = pickEnum(params.stock, STOCK_STATES);
  const page = pageNumber(params.page);
  const canAdjust = canAccess(profile, "inventory.write") || canAccess(profile, "catalog.write");

  const [inventory, counts] = await Promise.all([fetchInventory({ q, stock, page }), fetchAttentionCounts()]);

  const tabs = [
    { label: "All variants", value: null },
    { label: "Low stock", value: "low_stock", count: counts.lowStockVariants },
    { label: "Sold out", value: "sold_out", count: counts.soldOutVariants },
    { label: "In stock", value: "in_stock" },
  ].map((tab) => ({
    label: tab.label,
    href: hrefWith("/admin/inventory", params, { stock: tab.value }),
    active: stock === tab.value,
    count: tab.count,
  }));

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock per variant, lowest first. Low stock means at or below the product's alert threshold. Counts in tabs cover live products only."
      />
      <LinkTabs label="Stock filter" tabs={tabs} />
      <Panel title={`${formatCount(inventory.total)} variants`}>
        <FilterBar resetHref={hrefWith("/admin/inventory", {}, { stock })} hasFilters={Boolean(q)}>
          {stock ? <input type="hidden" name="stock" value={stock} /> : null}
          <FilterField label="Search product or SKU" htmlFor="inventory-q" className="md:w-72">
            <Input id="inventory-q" type="search" name="q" defaultValue={q} placeholder="e.g. PDE-GLD" maxLength={64} />
          </FilterField>
        </FilterBar>

        {inventory.rows.length === 0 ? (
          <EmptyState icon={PackageIcon} title="No variants match" description={stock === "sold_out" ? "Nothing is sold out right now." : "Try a different search."} />
        ) : (
          <>
            <TableScroll label="Inventory">
              <table className={cn(tableClasses, "min-w-[880px]")}>
                <thead>
                  <tr className={theadRowClasses}>
                    <th scope="col" className={thClasses}>Product</th>
                    <th scope="col" className={thClasses}>SKU</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Stock</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Alert at</th>
                    <th scope="col" className={thClasses}>State</th>
                    {canAdjust ? <th scope="col" className={thClasses}>Adjust</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {inventory.rows.map((row) => (
                    <tr key={row.variantId}>
                      <td className={tdClasses}>
                        <div className="flex flex-col">
                          <Link href={`/admin/products/${row.productId}`} className="rounded-xs font-medium hover:text-primary-600">
                            {row.productTitle}
                          </Link>
                          <span className="text-small text-neutral-500">
                            {[row.optionSummary, row.categoryTitle, row.productStatus !== "active" ? humanize(row.productStatus) : null].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      </td>
                      <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>{row.sku}</td>
                      <td className={cn(tdClasses, numericClasses, "font-semibold")}>{formatCount(row.stock)}</td>
                      <td className={cn(tdClasses, numericClasses, "text-neutral-500")}>{formatCount(row.threshold)}</td>
                      <td className={tdClasses}>{row.variantActive ? <StockPill state={row.stockState} /> : <ActivePill active={false} inactiveLabel="Variant off" />}</td>
                      {canAdjust ? (
                        <td className={tdClasses}>
                          <StockAdjustForm variantId={row.variantId} sku={row.sku} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <Pagination pathname="/admin/inventory" params={params} page={inventory.page} pageCount={inventory.pageCount} total={inventory.total} noun="variants" />
          </>
        )}
      </Panel>
    </>
  );
}
