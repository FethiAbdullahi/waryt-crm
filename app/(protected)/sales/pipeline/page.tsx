import { redirect } from "next/navigation";

export default function SalesPipelineRedirectPage() {
  redirect("/sales?tab=pipeline");
}
