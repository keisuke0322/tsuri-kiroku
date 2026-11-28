import { appStyles } from '@/lib/app-styles';
import { cn } from '@/lib/utils';

export default function Brand({
  variant = 'header',
}: {
  variant?: 'header' | 'login';
}) {
  return (
    <span
      className={cn(
        appStyles.brand,
        variant === 'login' && appStyles.brandLogin,
      )}
      data-cy="brand"
    >
      <img
        className={appStyles.brandSymbol}
        src="/brand/mark-color.svg"
        width={144}
        height={104}
        alt=""
        aria-hidden="true"
      />
      <span className={appStyles.brandWordmark}>
        <span className={appStyles.brandName}>つりめぐり</span>
        <span className={appStyles.brandEnglish}>TSURIMEGURI</span>
      </span>
    </span>
  );
}
