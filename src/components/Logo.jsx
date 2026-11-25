// Codixa mark, redrawn as vector from the brand app icon (1024 grid).
// The C body and the cyan diamond are separate paths so they can be animated independently.
export const C_PATH =
  'M460 245H512C590 245 652 290 652 352V467H612C588 467 568 447 568 423V378C568 350 545 328 512 328H460' +
  'C395 328 353 375 353 435V588C353 650 395 695 460 695H474C498 695 518 675 518 651V625' +
  'C518 601 538 581 562 581H608C632 581 652 601 652 625V672C652 735 590 778 512 778H460' +
  'C355 778 270 693 270 588V435C270 330 355 245 460 245Z';

export const DIAMOND_PATH = 'M677 454L735 512L677 570L619 512Z';

export const MARK_VIEWBOX = '262 237 481 549';

export function LogoMark({ size = 40, body = 'var(--c-blue)', diamond = 'var(--c-cyan)', title = 'Codixa', ...rest }) {
  return (
    <svg
      width={size}
      height={(size * 549) / 481}
      viewBox={MARK_VIEWBOX}
      role="img"
      aria-label={title}
      {...rest}
    >
      <path d={C_PATH} fill={body} />
      <path d={DIAMOND_PATH} fill={diamond} />
    </svg>
  );
}

export function Wordmark({ size = 32, body, diamond, textColor = 'currentColor', className = '' }) {
  return (
    <span className={`wordmark ${className}`} style={{ color: textColor }} dir="ltr">
      <LogoMark size={size} body={body} diamond={diamond} aria-hidden="true" title="" />
      <span className="wordmark__text" style={{ fontSize: size * 0.82 }}>Codixa</span>
    </span>
  );
}
