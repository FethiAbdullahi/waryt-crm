import { redirect } from "next/navigation";

export default function SalesPerformanceRedirectPage() {
  redirect("/sales?tab=performance");
}
