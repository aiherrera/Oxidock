type IconProps = {
  className?: string;
};

export const IconBox = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M12 12 20 7.5M12 12v9M12 12 4 7.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconImageStack = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M5 8.5 12 4l7 4.5-7 4.5-7-4.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="m5 12 7 4.5 7-4.5M5 15.5 12 20l7-4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconVolume = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <ellipse
      cx="12"
      cy="6"
      rx="7"
      ry="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export const IconNetwork = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <circle
      cx="6"
      cy="12"
      r="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle
      cx="18"
      cy="6"
      r="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle
      cx="18"
      cy="18"
      r="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="m8.6 10.5 6.8-3M8.6 13.5l6.8 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconEvents = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M6 5.5h12M6 12h12M6 18.5h12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="6"
      cy="5.5"
      r="2"
      fill="var(--sidebar)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle
      cx="18"
      cy="12"
      r="2"
      fill="var(--sidebar)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle
      cx="10"
      cy="18.5"
      r="2"
      fill="var(--sidebar)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export const IconRefresh = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M20 12a8 8 0 1 1-2.3-5.7M20 4v6h-6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconPlay = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M8 5.5v13l10-6.5-10-6.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconPause = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M8 6v12M16 6v12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconStop = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <rect
      x="7"
      y="7"
      width="10"
      height="10"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export const IconTrash = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M9 5h6M4 7h16M10 11v6M14 11v6M6.5 7l.8 13h9.4l.8-13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconPlus = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconSearch = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <circle
      cx="11"
      cy="11"
      r="6"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="m16 16 5 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconFilter = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M4 6h16M7 12h10M10 18h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconLogs = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M6 4h12a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M7 8h10M7 12h10M7 16h6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconTerminal = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="m5 8 4 4-4 4M11 16h8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export const IconChevronLeft = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="m15 6-6 6 6 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconChevronRight = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="m9 6 6 6-6 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconChevronDown = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="m6 9 6 6 6-6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconInfo = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <circle
      cx="12"
      cy="12"
      r="8"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M12 10v6M12 8h.01"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconMore = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <circle
      cx="6"
      cy="12"
      r="1.25"
      fill="currentColor"
    />
    <circle
      cx="12"
      cy="12"
      r="1.25"
      fill="currentColor"
    />
    <circle
      cx="18"
      cy="12"
      r="1.25"
      fill="currentColor"
    />
  </svg>
);

export const IconCopy = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <rect
      x="8"
      y="8"
      width="11"
      height="11"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export const IconExternal = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M14 5h5v5M10 14 19 5M19 19H5V5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconX = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M6 6l12 12M18 6 6 18"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconSun = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <circle
      cx="12"
      cy="12"
      r="4"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconMoon = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconBook = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M5 5.5A2.5 2.5 0 0 1 7.5 3h8.8a2.5 2.5 0 0 1 1.8.8l2.9 2.9v11.8A2.5 2.5 0 0 1 18 21H7.5A2.5 2.5 0 0 1 5 18.5V5.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M16 3v5.5H21.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 8h6M8 12h6M8 16h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconSettings = ({ className = "size-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M19.4 15a1.5 1.5 0 0 0 .3 1.7l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4V21a2 2 0 0 1-4 0v-.2a1.5 1.5 0 0 0-.9-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9H3a2 2 0 0 1 0-4h.2a1.5 1.5 0 0 0 1.4-.9 1.5 1.5 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.5 1.5 0 0 0 1.7.3 1.5 1.5 0 0 0 .9-1.4V3a2 2 0 0 1 4 0v.2a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.5 1.5 0 0 0-.3 1.7 1.5 1.5 0 0 0 1.4.9h.2a2 2 0 0 1 0 4h-.2a1.5 1.5 0 0 0-1.4.9Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
