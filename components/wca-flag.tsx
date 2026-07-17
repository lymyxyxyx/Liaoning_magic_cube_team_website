"use client";

import Image from "next/image";
import { useState } from "react";

function iso2ToFlagEmoji(iso2: string) {
  const upper = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  return String.fromCodePoint(...Array.from(upper).map((char) => 127397 + char.charCodeAt(0)));
}

export function WcaFlag({ country, iso2 }: { country: string; iso2?: string | null }) {
  const normalizedIso2 = iso2?.trim().toLowerCase();
  const countryKey = country.toLowerCase().replaceAll(" ", "-");
  const [failedIso2, setFailedIso2] = useState<string | null>(null);

  if (normalizedIso2 === "tw" || countryKey === "chinese-taipei") {
    return (
      <span className="wca-flag flag-svg" aria-hidden="true">
        <Image src="/flags/tw.svg" width={28} height={20} alt="" unoptimized />
      </span>
    );
  }

  if (normalizedIso2 && /^[a-z]{2}$/.test(normalizedIso2)) {
    return (
      <span className="wca-flag flag-emoji" aria-hidden="true">
        {failedIso2 === normalizedIso2 ? (
          <span>{iso2ToFlagEmoji(normalizedIso2)}</span>
        ) : (
          <Image
            src={`/flags/${normalizedIso2}.svg`}
            width={28}
            height={20}
            alt=""
            unoptimized
            onError={() => setFailedIso2(normalizedIso2)}
          />
        )}
      </span>
    );
  }
  const emoji = iso2?.trim() ? iso2ToFlagEmoji(iso2.trim()) : "";
  if (emoji) {
    return (
      <span className="wca-flag flag-emoji" aria-hidden="true">
        <span>{emoji}</span>
      </span>
    );
  }
  if (countryKey === "china") {
    return (
      <span className="wca-flag flag-svg" aria-hidden="true">
        <svg viewBox="0 0 30 20" preserveAspectRatio="none" role="img">
          <rect width="30" height="20" fill="#EE1C25" />
          <path
            d="M6 2.3l.76 2.18h2.3L7.2 5.82l.73 2.2L6 6.67 4.07 8.02l.73-2.2L2.94 4.48h2.3L6 2.3z"
            fill="#FFDE00"
          />
          <path d="M10.3 2.1l.32.9h.95l-.76.56.29.9-.8-.56-.8.56.3-.9-.76-.56h.94l.32-.9z" fill="#FFDE00" />
          <path d="M11.8 3.9l.32.9h.95l-.76.56.29.9-.8-.56-.8.56.3-.9-.76-.56h.94l.32-.9z" fill="#FFDE00" />
          <path d="M11.5 6.3l.32.9h.95l-.76.56.29.9-.8-.56-.8.56.3-.9-.76-.56h.94l.32-.9z" fill="#FFDE00" />
          <path d="M10 8.1l.32.9h.95l-.76.56.29.9-.8-.56-.8.56.3-.9-.76-.56h.94l.32-.9z" fill="#FFDE00" />
        </svg>
      </span>
    );
  }
  return <span className={`wca-flag flag-${countryKey}`} aria-hidden="true" />;
}
