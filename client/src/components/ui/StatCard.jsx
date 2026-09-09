import React from 'react';
import { Card } from './primitives';
import { cx } from './utils';

export default function StatCard({ label, value, icon, description, loading = false, className }) {
  return (
    <Card className={cx('sf-stat-card', className)} aria-busy={loading}>
      <dl>
        <dt className="sf-stat-card__label">
          {icon && <span aria-hidden="true">{icon}</span>}{label}
        </dt>
        <dd className="sf-stat-card__value">{loading ? 'Loading…' : (value ?? '—')}</dd>
      </dl>
      {description && <p className="sf-small sf-muted">{description}</p>}
    </Card>
  );
}
