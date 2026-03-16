"use client";

import { useEffect, useState } from "react";
import { getRewardfulReferral, waitForRewardfulReferral, withRewardfulReferral } from "@/lib/rewardful";

export function useRewardfulLink(url: string): string {
  const [referral, setReferral] = useState(() => getRewardfulReferral());

  useEffect(() => {
    let isActive = true;

    void waitForRewardfulReferral().then((nextReferral) => {
      if (!isActive) return;
      setReferral(nextReferral);
    });

    return () => {
      isActive = false;
    };
  }, []);

  return withRewardfulReferral(url, referral);
}
