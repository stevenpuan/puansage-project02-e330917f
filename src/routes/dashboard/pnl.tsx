// src/routes/dashboard/pnl.tsx
import { createFileRoute } from "@tanstack/react-router";
import MonthlyPnl from "../../components/finance/MonthlyPnl";

export const Route = createFileRoute("/dashboard/pnl")({
  component: MonthlyPnl,
});
