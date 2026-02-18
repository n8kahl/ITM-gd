import React from "react";
import { BRAND_LOGO_SRC } from "@/lib/brand";

interface StructuredDataProps {
  baseUrl?: string;
  nonce?: string;
}

export function StructuredData({ baseUrl, nonce }: StructuredDataProps) {
  const resolvedBaseUrl = (
    baseUrl
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || 'https://tradeitm.com'
  ).replace(/\/+$/, '')

  // In development, middleware/header timing can cause nonce hydration drift.
  const scriptNonce = process.env.NODE_ENV === 'production'
    ? (nonce?.trim() || undefined)
    : undefined;
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Core Sniper Trading Membership",
    "description": "Premium trading membership with quality trade setups alerted daily. Real-time trade alerts, expert education, and a proven track record from professional traders.",
    "brand": {
      "@type": "Brand",
      "name": "Trade In The Money"
    },
    "offers": {
      "@type": "Offer",
      "url": `${resolvedBaseUrl}/#pricing`,
      "priceCurrency": "USD",
      "price": "199.00",
      "priceValidUntil": "2026-12-31",
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "bestRating": "5",
      "worstRating": "1",
      "ratingCount": "124",
      "reviewCount": "124"
    },
    "image": `${resolvedBaseUrl}/og-image.png`,
    "url": `${resolvedBaseUrl}/#pricing`
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Trade In The Money",
    "url": resolvedBaseUrl,
    "logo": `${resolvedBaseUrl}${BRAND_LOGO_SRC}`,
    "description": "Premium trade alerts and education platform for serious traders.",
    "sameAs": []
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Trade In The Money",
    "url": resolvedBaseUrl,
    "description": "Premium Trade Alerts & Education - Quality Setups Alerted Daily",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${resolvedBaseUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={scriptNonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema),
        }}
      />
      <script
        type="application/ld+json"
        nonce={scriptNonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        nonce={scriptNonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema),
        }}
      />
    </>
  );
}
