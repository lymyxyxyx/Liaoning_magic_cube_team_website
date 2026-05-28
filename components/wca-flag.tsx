export function WcaFlag({ country }: { country: string }) {
  const countryKey = country.toLowerCase().replaceAll(" ", "-");
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
