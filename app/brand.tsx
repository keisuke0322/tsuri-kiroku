export default function Brand({
  variant = 'header',
}: {
  variant?: 'header' | 'login';
}) {
  return (
    <span className={`brand brand-${variant}`} data-cy="brand">
      <img
        className="brand-symbol"
        src="/brand/mark-color.svg"
        width={144}
        height={104}
        alt=""
        aria-hidden="true"
      />
      <span className="brand-wordmark">
        <span className="brand-name">つりめぐり</span>
        <span className="brand-english">TSURIMEGURI</span>
      </span>
    </span>
  );
}
