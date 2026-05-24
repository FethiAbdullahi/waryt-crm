import { redirect } from "next/navigation";

export default function SalesFieldRedirectPage() {
  redirect("/sales?tab=field");
}
