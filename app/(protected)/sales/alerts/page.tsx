import { redirect } from "next/navigation";

export default function SalesAlertsRedirectPage() {
  redirect("/sales?tab=alerts");
}
