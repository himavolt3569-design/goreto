import { Card } from "@/components/ui/card";
import type { ProductSpec } from "@/features/catalog/types";

/** "Product Details" specification table. */
export function ProductSpecs({ specs }: { specs: ProductSpec[] }) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="font-display text-h2 text-neutral-900">Product Details</h2>
      {specs.length === 0 ? (
        <p className="text-body text-neutral-500">Specifications will be added soon.</p>
      ) : (
        <table className="w-full border-collapse text-left text-body">
          <tbody>
            {specs.map((spec) => (
              <tr key={spec.label} className="odd:bg-neutral-50">
                <th
                  scope="row"
                  className="w-2/5 rounded-l-xs px-3 py-3 align-top font-medium text-neutral-900"
                >
                  {spec.label}
                </th>
                <td className="rounded-r-xs px-3 py-3 text-neutral-700">{spec.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
