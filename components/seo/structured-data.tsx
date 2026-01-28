import React from "react";

interface StructuredDataProps {
  baseUrl?: string;
}

export function StructuredData({ baseUrl = "https://trade-itm-prod.up.railway.app" }: StructuredDataProps) {
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Elite Trading Membership",
    "description": "Premium trading signals membership with 3 guaranteed 100%+ trades every week. Real-time alerts, expert education, and a proven track record from professional traders.",
    "brand": {
      "@type": "Brand",
      "name": "Trade In The Money"
    },
    "offers": {
      "@type": "Offer",
      "url": `${baseUrl}/#pricing`,
      "priceCurrency": "USD",
      "price": "99",
      "priceValidUntil": "2026-12-31",
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "bestRating": "5",
      "worstRating": "1",
      "ratingCount": "120",
      "reviewCount": "120"
    },
    "image": `${baseUrl}/og-image.png`,
    "url": `${baseUrl}/#pricing`
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Trade In The Money",
    "url": baseUrl,
    "logo": `${baseUrl}/hero-logo.png`,
    "description": "Premium trading signals and education platform for serious traders.",
    "sameAs": []
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Trade In The Money",
    "url": baseUrl,
    "description": "Premium Trading Signals & Education - 3 Guaranteed 100%+ Trades Every Week",
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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema),
        }}
      />
    </>
  );
}
