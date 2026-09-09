import React from 'react';
import { Card } from './primitives';
import { cx } from './utils';

// Balance is a display value from the caller, never a locally calculated amount.
export default function WalletBalanceCard({ balance, label = 'Available balance', description,
  action, loading = false, className }) {
  return (
    <Card className={cx('sf-wallet-balance-card', className)} aria-busy={loading}>
      <div>
        <dl><dt className="sf-small">{label}</dt><dd className="sf-wallet-balance-card__value">{loading ? 'Loading…' : (balance ?? '—')}</dd></dl>
        {description && <p className="sf-small">{description}</p>}
      </div>
      {action && <div className="sf-card-actions">{action}</div>}
    </Card>
  );
}
