/** Parrot mark: a macaw head in profile, teal with a pale face patch and dark hooked beak. */
export function ParrotMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="cr-mark"
    >
      <path
        d="M4.5 16.5a11.5 11.5 0 0 1 20.3-7.4l-5.6 6.3c-1.8 2-2.7 4.8-2.7 8.4v4.7H9a4.5 4.5 0 0 1-4.5-4.5Z"
        fill="var(--teal)"
      />
      <path
        d="M15.2 9.3c2.5-1.5 6.4-1.3 9.4.2l-5 5.4c-1.7.6-3.6.3-4.9-.8-1.1-1.1-.8-3 .5-4.8Z"
        fill="var(--paper)"
      />
      <path
        d="M24.8 9.1c4 1.2 5.7 5.1 4.2 9.4-1-2-2.7-2.9-4.9-2.8l-4.9-.5Z"
        fill="var(--ink)"
      />
      <path d="M19.2 15.2 24.1 15.7c.7.4 1.2.9 1.5 1.6-2.4 1.1-5 1.1-7 .1-.5-.3-.5-1 .1-1.4Z" fill="var(--ink)" />
      <circle cx="18" cy="11.7" r="1.25" fill="var(--ink)" />
      <path
        d="M8.6 4.8c1.7.6 2.9 1.9 3.5 3.6M13.2 2.6c1.5 1 2.3 2.5 2.4 4.3"
        stroke="var(--teal)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className={`cr-wordmark cr-wordmark--${size}`}>
      <ParrotMark size={size === "lg" ? 38 : 26} />
      <span className="cr-wordmark__text">Parrot</span>
    </span>
  );
}
