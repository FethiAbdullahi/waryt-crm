"use client";

import { useEffect, useLayoutEffect } from "react";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { ReportsPageClient } from "@/components/reports/reports-page-client";
import { deriveHubViewFromLocation, useHubViewStore, type HubView } from "@/lib/stores/hub-view-store";
import type { Profile } from "@/lib/types";

function HubPopstateSync() {
  useEffect(() => {
    const onPop = () => {
      const v = deriveHubViewFromLocation();
      if (v != null) useHubViewStore.getState().boot(v);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return null;
}

export function ProtectedHubPanels({
  userId,
  profile,
  serverView,
}: {
  userId: string;
  profile: Profile;
  serverView: HubView;
}) {
  const view = useHubViewStore((s) => s.view);

  useLayoutEffect(() => {
    useHubViewStore.getState().boot(serverView);
  }, [serverView]);

  return (
    <>
      <HubPopstateSync />
      {view === "home" ? <DashboardHome profile={profile} userId={userId} /> : null}
      {view === "reports" ? <ReportsPageClient profile={profile} /> : null}
    </>
  );
}
