import { redirect } from "next/navigation";

/** @deprecated Bookmarks — org reporting lives under Waryt Studio. */
export default function DataPageRedirect() {
  redirect("/sales?tab=reporting");
}
