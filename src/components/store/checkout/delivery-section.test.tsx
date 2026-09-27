import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { CheckoutQuote } from "@/features/checkout/quote";
import type { CheckoutFormValues } from "@/features/checkout/schemas";
import { DeliverySection } from "./delivery-section";

const quote: CheckoutQuote = {
  lines: [],
  subtotalPaisa: 629800,
  zoneName: "Kathmandu Valley",
  deliveryOptions: [
    {
      courierServiceId: "11111111-1111-4111-8111-111111111111",
      serviceName: "Standard Delivery",
      serviceLevel: "standard",
      description: "Reliable delivery across Nepal",
      courierName: "Pathao",
      pricePaisa: 10000,
      estimatedMinDays: 3,
      estimatedMaxDays: 5,
    },
    {
      courierServiceId: "22222222-2222-4222-8222-222222222222",
      serviceName: "Express Delivery",
      serviceLevel: "express",
      description: "",
      courierName: "Pathao",
      pricePaisa: 20000,
      estimatedMinDays: 1,
      estimatedMaxDays: 2,
    },
  ],
  selectedDelivery: null,
  coupon: null,
  discountPaisa: 0,
  deliveryFeePaisa: 0,
  totalPaisa: 629800,
  codEnabled: true,
  codMaxOrderPaisa: null,
};

const probe: { getValues?: () => CheckoutFormValues } = {};
const values = () => probe.getValues!();

function Harness(props: { quote: CheckoutQuote | null; loading?: boolean; hasAddress?: boolean }) {
  const form = useForm<CheckoutFormValues>({ defaultValues: { courierServiceId: "" } });
  useEffect(() => {
    probe.getValues = form.getValues;
  }, [form]);
  return (
    <FormProvider {...form}>
      <DeliverySection quote={props.quote} loading={props.loading ?? false} hasAddress={props.hasAddress ?? true} />
    </FormProvider>
  );
}

describe("DeliverySection", () => {
  it("asks for an address first", () => {
    render(<Harness quote={quote} hasAddress={false} />);
    expect(screen.getByText(/Choose your municipality above/)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("offers the services for the address with real fees and estimates", () => {
    render(<Harness quote={quote} />);
    const express = screen.getByRole("radio", { name: /Express Delivery/ });
    expect(screen.getByRole("radio", { name: /Standard Delivery.*3–5 business days.*Rs\. 100/ })).toBeInTheDocument();
    fireEvent.click(express);
    expect(values().courierServiceId).toBe("22222222-2222-4222-8222-222222222222");
    expect(screen.getByText("By Pathao")).toBeInTheDocument();
  });

  it("says so when no service delivers to the address", () => {
    render(<Harness quote={{ ...quote, deliveryOptions: [] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("We don’t deliver to this area yet");
  });
});
