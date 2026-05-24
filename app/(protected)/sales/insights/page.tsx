import { redirect } from "next/navigation";

export default function SalesInsightsRedirectPage() {
  redirect("/sales?tab=insights");
}
