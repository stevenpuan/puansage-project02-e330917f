// src/routes/dashboard/accounts.tsx
import { createFileRoute } from "@tanstack/react-router";
import AccountsList from "../../components/accounts/AccountsList";

export const Route = createFileRoute("/dashboard/accounts")({
  component: AccountsList,
});
