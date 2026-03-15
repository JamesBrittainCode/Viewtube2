import React from 'react';

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be raw JSON, not escaped text nodes.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

