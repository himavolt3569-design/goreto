import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, FilterBar, FilterField, PageHeader, Pagination, Panel, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { UsersIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDate } from "@/features/admin/format";
import { CUSTOMER_SORTS, fetchCustomers } from "@/features/admin/queries/customers";
import { pageNumber, pickEnum } from "@/features/admin/queries/shared";
import { sanitizeSearch } from "@/features/admin/search-input";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Customers" };

const SORT_LABELS = { newest: "Newest first", billed: "Most billed", orders: "Most orders", recent_order: "Recent order" } as const;

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdminAccess("customers.read");
  const params = await searchParams;
  const q = sanitizeSearch(params.q);
  const sort = pickEnum(params.sort, CUSTOMER_SORTS) ?? "newest";
  const page = pageNumber(params.page);
  const customers = await fetchCustomers({ q, sort, page });

  return (
    <>
      <PageHeader
        title="Customers"
        description="Registered customers. Billed counts only cash collected on delivery; guest orders appear under Orders."
      />
      <Panel title={`${formatCount(customers.total)} customers`}>
        <FilterBar resetHref="/admin/customers" hasFilters={Boolean(q) || sort !== "newest"}>
          <FilterField label="Name or email" htmlFor="customer-q" className="md:w-72">
            <Input id="customer-q" type="search" name="q" defaultValue={q} maxLength={64} />
          </FilterField>
          <FilterField label="Sort" htmlFor="customer-sort">
            <Select
              id="customer-sort"
              name="sort"
              defaultValue={sort}
              options={CUSTOMER_SORTS.map((value) => ({ value, label: SORT_LABELS[value] }))}
            />
          </FilterField>
        </FilterBar>

        {customers.rows.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No customers match" />
        ) : (
          <>
            <TableScroll label="Customers">
              <table className={cn(tableClasses, "min-w-[880px]")}>
                <thead>
                  <tr className={theadRowClasses}>
                    <th scope="col" className={thClasses}>Customer</th>
                    <th scope="col" className={thClasses}>Joined</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Orders</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Billed</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>COD pending</th>
                    <th scope="col" className={thClasses}>Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.rows.map((customer) => (
                    <tr key={customer.id} className="hover:bg-neutral-50">
                      <td className={tdClasses}>
                        <Link href={`/admin/customers/${customer.id}`} className="group flex flex-col rounded-sm">
                          <span className="font-medium group-hover:text-primary-600">{customer.fullName ?? "Name not set"}</span>
                          <span className="text-small text-neutral-500">{customer.email ?? "No verified email"}</span>
                        </Link>
                      </td>
                      <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>{formatDate(customer.createdAt)}</td>
                      <td className={cn(tdClasses, numericClasses)}>{formatCount(customer.orderCount)}</td>
                      <td className={cn(tdClasses, numericClasses, "font-medium")}>{formatNpr(customer.billedPaisa)}</td>
                      <td className={cn(tdClasses, numericClasses, "text-neutral-700")}>{customer.pendingPaisa > 0 ? formatNpr(customer.pendingPaisa) : "—"}</td>
                      <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>{formatDate(customer.lastOrderAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <Pagination pathname="/admin/customers" params={params} page={customers.page} pageCount={customers.pageCount} total={customers.total} noun="customers" />
          </>
        )}
      </Panel>
    </>
  );
}
