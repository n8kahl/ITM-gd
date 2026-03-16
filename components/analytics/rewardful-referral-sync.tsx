"use client";

import { useEffect } from "react";
import { waitForRewardfulReferral } from "@/lib/rewardful";

export function RewardfulReferralSync() {
  useEffect(() => {
    void waitForRewardfulReferral(2000);
  }, []);

  return null;
}
