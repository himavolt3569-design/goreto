// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signRequest, verifyWebhookSignature, webhookSignature } from "./sign";

describe("signRequest", () => {
  it("matches the worked example in Daraz's HTTP request guide", () => {
    // open.daraz.com doc 503: GetOrder with app secret "helloworld".
    const sign = signRequest(
      "/order/get",
      { app_key: "123456", access_token: "test", timestamp: "1517820392000", sign_method: "sha256", order_id: "1234" },
      "helloworld",
    );
    expect(sign).toBe("4190D32361CFB9581350222F345CB77F3B19F0E31D162316848A2C1FFD5FAB4A");
  });

  it("sorts by name, skips sign and empty values, and hashes JSON parameters as sent", () => {
    const params = { b: "2", a: "1", sign: "ignored", empty: "", items: '[{"name":"Kurta"}]' };
    const expected = createHmac("sha256", "s").update('/x/ya1b2items[{"name":"Kurta"}]').digest("hex").toUpperCase();
    expect(signRequest("/x/y", params, "s")).toBe(expected);
  });
});

describe("webhook signatures", () => {
  const body = '{"seller_id":"1","message_type":14}';

  it("accepts the documented app key + body HMAC in either hex case", () => {
    const signature = webhookSignature("123456", body, "secret");
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyWebhookSignature("123456", body, signature, "secret")).toBe(true);
    expect(verifyWebhookSignature("123456", body, signature.toUpperCase(), "secret")).toBe(true);
  });

  it("rejects missing, malformed, wrong-key and tampered signatures", () => {
    const signature = webhookSignature("123456", body, "secret");
    expect(verifyWebhookSignature("123456", body, null, "secret")).toBe(false);
    expect(verifyWebhookSignature("123456", body, "abc", "secret")).toBe(false);
    expect(verifyWebhookSignature("999999", body, signature, "secret")).toBe(false);
    expect(verifyWebhookSignature("123456", body + " ", signature, "secret")).toBe(false);
  });
});
