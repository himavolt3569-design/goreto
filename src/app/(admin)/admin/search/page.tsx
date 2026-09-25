import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel, Thumb } from "@/components/admin/admin-ui";
import { HeaderSearch } from "@/components/admin/header-search";
import { MagnifyingGlassIcon } from "@/components/ui/icons";
import { Card } from "@/components/ui/card";
import { OrderStatusPill } from "@/components/ui/status";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatDate, humanize } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import { searchCustomers, searchOrders, searchProducts } from "@/features/admin/queries/search";
import { sanitizeSearch } from "@/features/admin/search-input";
import { formatNpr } from "@/lib/money/format";

export const metadata: Metadata = { title: "Search" };

export default async function AdminSearchPage({ searchParams }: PageProps<"/admin/search">) {
  const profile = await requireAdminAccess("admin");
  const params = await searchParams;
  const term = sanitizeSearch(params.q);

  const canProducts = canAccess(profile, "catalog.read");
  const canOrders = canAccess(profile, "orders.read");
  const canCustomers = canAccess(profile, "customers.read");
  const searchable = [canProducts && "products", canOrders && "orders", canCustomers && "customers"].filter(Boolean).join(", ");

  const [products, orders, customers] = term.length >= 2
    ? await Promise.all([
        canProducts ? searchProducts(term) : null,
        canOrders ? searchOrders(term) : null,
        canCustomers ? searchCustomers(term) : null,
      ])
    : [null, null, null];
  const total = (products?.length ?? 0) + (orders?.length ?? 0) + (customers?.length ?? 0);

  return (
    <>
      <PageHeader title="Search" description={searchable ? `Find ${searchable}.` : "You don't have access to any searchable areas yet."} />
      <HeaderSearch defaultValue={term} className="w-full max-w-xl" />

      {term.length < 2 ? (
        <Card>
          <EmptyState icon={MagnifyingGlassIcon} title="Type at least two characters" description="Search by product name or SKU, order number, or a customer's name or email." />
        </Card>
      ) : total === 0 ? (
        <Card>
          <EmptyState icon={MagnifyingGlassIcon} title={`No results for “${term}”`} description="Check the spelling, or try an order number like GT2609241234." />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {products ? (
            <Panel title="Products" description={`${products.length} shown`} bodyClassName="px-2 pb-4">
              {products.length === 0 ? (
                <p className="px-4 text-body text-neutral-500">No products match.</p>
              ) : (
                <ul className="flex flex-col">
                  {products.map((product) => (
                    <li key={product.id}>
                      <Link href={`/admin/products/${product.id}`} className="flex items-center gap-3 rounded-md px-4 py-2 hover:bg-neutral-50">
                        <Thumb src={product.thumbnail} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-neutral-900">{product.title}</span>
                          <span className="text-small text-neutral-500">{[humanize(product.status), product.matchedSku ? `SKU ${product.matchedSku}` : null].filter(Boolean).join(" · ")}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          {orders ? (
            <Panel title="Orders" description={`${orders.length} shown`} bodyClassName="px-2 pb-4">
              {orders.length === 0 ? (
                <p className="px-4 text-body text-neutral-500">No orders match.</p>
              ) : (
                <ul className="flex flex-col">
                  {orders.map((order) => (
                    <li key={order.orderNumber}>
                      <Link href={`/admin/orders/${order.orderNumber}`} className="flex items-center justify-between gap-3 rounded-md px-4 py-2 hover:bg-neutral-50">
                        <span className="flex min-w-0 flex-col">
                          <span className="font-medium text-neutral-900">#{order.orderNumber}</span>
                          <span className="truncate text-small text-neutral-500">
                            {order.contactName} · {formatDate(order.createdAt)} · {formatNpr(order.totalPaisa)}
                          </span>
                        </span>
                        <OrderStatusPill status={order.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          {customers ? (
            <Panel title="Customers" description={`${customers.length} shown`} bodyClassName="px-2 pb-4">
              {customers.length === 0 ? (
                <p className="px-4 text-body text-neutral-500">No customers match.</p>
              ) : (
                <ul className="flex flex-col">
                  {customers.map((customer) => (
                    <li key={customer.id}>
                      <Link href={`/admin/customers/${customer.id}`} className="flex flex-col rounded-md px-4 py-2 hover:bg-neutral-50">
                        <span className="font-medium text-neutral-900">{customer.fullName ?? "Name not set"}</span>
                        <span className="truncate text-small text-neutral-500">{customer.email ?? "No verified email"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </div>
      )}
    </>
  );
}
