import { redirect } from "next/navigation";

export default function SalesProspectsRedirectPage() {
  redirect("/sales?tab=prospects");
}
