import { redirect } from "next/navigation";

export default function SalesReportingRedirectPage() {
  redirect("/sales?tab=reporting");
}
