import React from "react";
import { BRAND_LOGO_SRC } from "@/lib/brand";

interface StructuredDataProps {
  baseUrl?: string;
  nonce?: string;
}

export function StructuredData({ baseUrl = "https://trade-itm-prod.up.railway.app", nonce }: StructuredDataProps) {
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
      "url": `${baseUrl}/#pricing`,
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
    "image": `${baseUrl}/og-image.png`,
    "url": `${baseUrl}/#pricing`
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Trade In The Money",
    "url": baseUrl,
    "logo": `${baseUrl}${BRAND_LOGO_SRC}`,
    "description": "Premium trade alerts and education platform for serious traders.",
    "sameAs": []
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Trade In The Money",
    "url": baseUrl,
    "description": "Premium Trade Alerts & Education - Quality Setups Alerted Daily",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${baseUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema),
        }}
      />
    </>
  );
}
