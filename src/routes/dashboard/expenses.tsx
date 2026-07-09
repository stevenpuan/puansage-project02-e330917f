// src/routes/dashboard/expenses.tsx
import { createFileRoute } from "@tanstack/react-router";
import ExpensesList from "../../components/finance/ExpensesList";

export const Route = createFileRoute("/dashboard/expenses")({
  component: ExpensesList,
});
