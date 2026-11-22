/** Crew Radio mark: a handheld radio with a teal talk speaker. */
export function RadioMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="cr-mark"
    >
      <path d="M15.5 8.2 18.6 2.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="3" y="8" width="18" height="14" rx="4.5" fill="currentColor" />
      <circle cx="9.2" cy="15" r="3.4" fill="var(--teal-bright)" />
      <path d="M14.6 12.9h3.2M14.6 17.1h3.2" stroke="var(--paper)" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className={`cr-wordmark cr-wordmark--${size}`}>
      <RadioMark size={size === "lg" ? 34 : 24} />
      <span className="cr-wordmark__text">Crew Radio</span>
    </span>
  );
}
