"use client";

import { cn } from "@/lib/utils";

interface RiskDisclaimerProps {
  variant?: "inline" | "banner" | "compact";
  className?: string;
}

export function RiskDisclaimer({ variant = "inline", className }: RiskDisclaimerProps) {
  if (variant === "banner") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-champagne/15 bg-[linear-gradient(135deg,rgba(245,158,11,0.08),rgba(255,255,255,0.03))]",
          "px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-5",
          className,
        )}
      >
        <p className="text-center text-[11px] leading-relaxed text-platinum/72 sm:text-xs">
          <strong className="font-semibold tracking-[0.14em] text-champagne/85 uppercase">Risk Disclosure</strong>
          {" "}Trading options involves substantial risk of loss and is not suitable for all investors.
          Past performance does not guarantee future results. All content is for educational purposes only and does not constitute investment advice.
        </p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <p className={cn("text-xs leading-relaxed text-muted-foreground/60", className)}>
        Trading involves substantial risk. Past performance does not guarantee future results.
        Content is educational only and not investment advice.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-champagne/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(245,158,11,0.04))]",
        "p-4 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl",
        className,
      )}
    >
      <p className="text-xs leading-relaxed text-platinum/68">
        <strong className="font-semibold text-champagne/88">Risk Disclosure:</strong>{" "}
        Trading options and other financial instruments involves substantial risk of loss and is not suitable for all investors.
        You could lose some or all of your invested capital. Past performance is not indicative of future results.
        Trade In The Money provides educational content only and does not provide personalized investment advice.
      </p>
    </div>
  );
}
