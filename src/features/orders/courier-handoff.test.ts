import { describe, expect, it } from "vitest";
import { buildCourierMessage, formatCourierAddress, whatsappLink, type CourierMessageInput } from "./courier-handoff";

const input: CourierMessageInput = {
  storeName: "Goreto.store",
  orderNumber: "GT260927123456",
  recipientName: "Sita Gurung",
  phoneE164: "+9779812345678",
  address: {
    street_landmark: "Lakeside, near the boat station",
    municipality_name: "Pokhara Metropolitan City",
    ward: 6,
    district_name: "Kaski",
    province_name: "Gandaki Province",
    postal_code: "33700",
  },
  serviceName: "Pathao · Express",
  codAmountPaisa: 549900,
  items: [
    { title: "Silver Hoop Earrings", variant: "Gold / M", quantity: 2 },
    { title: "Pashmina Shawl", variant: null, quantity: 1 },
  ],
};

describe("buildCourierMessage", () => {
  it("carries what delivery needs: order, recipient, phone, address, COD amount and items", () => {
    expect(buildCourierMessage(input)).toBe(
      [
        "New delivery from Goreto.store",
        "Order #GT260927123456",
        "",
        "Recipient: Sita Gurung",
        "Phone: +977 981 2345678",
        "Address: Lakeside, near the boat station, Pokhara Metropolitan City, Ward 6, Kaski, Gandaki Province 33700",
        "Service: Pathao · Express",
        "Cash to collect: Rs. 5,499",
        "",
        "Items:",
        "• Silver Hoop Earrings (Gold / M) × 2",
        "• Pashmina Shawl × 1",
      ].join("\n"),
    );
  });

  it("leaves out missing parts and caps long item lists", () => {
    const many = Array.from({ length: 18 }, (_, index) => ({ title: `Item ${index + 1}`, variant: null, quantity: 1 }));
    const message = buildCourierMessage({ ...input, serviceName: null, items: many });
    expect(message).not.toContain("Service:");
    expect(message).toContain("• Item 15 × 1");
    expect(message).not.toContain("Item 16");
    expect(message).toContain("• …and 3 more items");
  });

  it("never includes an email address", () => {
    expect(buildCourierMessage(input)).not.toMatch(/@/);
  });
});

describe("formatCourierAddress", () => {
  it("skips empty fields", () => {
    expect(formatCourierAddress({ street_landmark: "Thamel", municipality_name: "Kathmandu", postal_code: null })).toBe("Thamel, Kathmandu");
  });
});

describe("whatsappLink", () => {
  it("uses the number's digits and encodes the text", () => {
    expect(whatsappLink("+9779812345678")).toBe("https://wa.me/9779812345678");
    expect(whatsappLink("+9779812345678", "Order #1\nRs. 5 & more")).toBe(
      "https://wa.me/9779812345678?text=Order%20%231%0ARs.%205%20%26%20more",
    );
  });
});
