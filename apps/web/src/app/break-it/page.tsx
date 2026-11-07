import type { Metadata } from "next";
import { BreakIt } from "./BreakIt";

export const metadata: Metadata = {
  title: "Break a payment · Guardrail Agent",
  description: "Try to make a testnet agent pay the wrong invoice. Policy decides whether anything is broadcast.",
};

export default function BreakItPage() {
  return <BreakIt />;
}
