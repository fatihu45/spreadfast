import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from './primitives';
import CampaignStatusBadge from './CampaignStatusBadge';
import PlatformBadge from './PlatformBadge';
import UiIcon from './UiIcon';
import { cx } from './utils';

export default function CampaignCard({ title, description, imageSrc, imageAlt = '', status,
  platforms = [], budget, budgetLabel = 'Budget', metadata, actions, to,
  headingAs: Heading = 'h3', className }) {
  const [failedImage, setFailedImage] = useState(null);
  return (
    <Card as="article" className={cx('sf-campaign-card', className)}>
      <div className="sf-campaign-card__layout">
      <div className="sf-campaign-card__image">
        {imageSrc && failedImage !== imageSrc
          ? <img src={imageSrc} alt={imageAlt} loading="lazy" onError={() => setFailedImage(imageSrc)} />
          : <UiIcon name="campaign" />}
      </div>
      <div className="sf-campaign-card__body">
        <div className="sf-campaign-card__heading">
          <Heading className="sf-heading">{to ? <Link className="sf-text-link" to={to}>{title}</Link> : title}</Heading>
          {status != null && <CampaignStatusBadge status={status} />}
        </div>
        {description && <p className="sf-small sf-muted">{description}</p>}
        {platforms.length > 0 && <div className="sf-platform-list">{platforms.map(platform => <PlatformBadge key={platform} platform={platform} />)}</div>}
        {metadata && <div className="sf-small sf-muted">{metadata}</div>}
      </div>
      {(budget != null || actions) && <div className="sf-campaign-card__aside">
        {budget != null && <dl><dt className="sf-caption sf-muted">{budgetLabel}</dt><dd className="sf-campaign-card__budget">{budget}</dd></dl>}
        {actions && <div className="sf-card-actions">{actions}</div>}
      </div>}
      </div>
    </Card>
  );
}
