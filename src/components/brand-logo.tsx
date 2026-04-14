import oxidockLogo from "../assets/oxidock-app-icon.png";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  if (compact) {
    return (
      <img
        alt="Oxidock"
        className={`size-9 shrink-0 rounded-lg ${className}`}
        height={36}
        src={oxidockLogo}
        width={36}
      />
    );
  }

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <img
        alt=""
        aria-hidden
        className="size-8 shrink-0 rounded-lg"
        height={32}
        src={oxidockLogo}
        width={32}
      />
      <div className="min-w-0 leading-none">
        <p className="truncate text-lg font-semibold tracking-tight text-(--text-primary)">Oxidock</p>
        <p className="truncate text-[0.65rem] uppercase tracking-[0.18em] text-(--text-muted)">container ops</p>
      </div>
    </div>
  );
}
