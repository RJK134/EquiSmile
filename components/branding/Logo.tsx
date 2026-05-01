import Image from 'next/image';

interface LogoProps {
  /** Pixel size of the longest dimension. Defaults to 32 — header-friendly. */
  size?: number;
  /**
   * Visual emphasis: `nav` (default) is the in-app header treatment,
   * `hero` doubles the size for the login page, `print` strips the
   * Image optimiser for PDF / email contexts where Next.js's
   * `next/image` server is unavailable.
   */
  variant?: 'nav' | 'hero' | 'print';
  className?: string;
}

/**
 * EquiSmile wordmark. Sources `/logo.svg` from public/ — currently a
 * maroon placeholder until the real asset lands. Components anywhere
 * (header, login, invoice PDF, monthly report) should reach for this
 * single source of truth so the swap is a one-file change later.
 */
export function Logo({ size = 32, variant = 'nav', className }: LogoProps) {
  const dimensions = variant === 'hero' ? size * 2 : size;
  const altText = 'EquiSmile';

  // PDF + email contexts can't use next/image — emit a plain <img>.
  if (variant === 'print') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo.svg"
        alt={altText}
        width={dimensions * (220 / 56)}
        height={dimensions}
        className={className}
      />
    );
  }

  return (
    <Image
      src="/logo.svg"
      alt={altText}
      width={dimensions * (220 / 56)}
      height={dimensions}
      priority={variant === 'hero'}
      className={className}
    />
  );
}
