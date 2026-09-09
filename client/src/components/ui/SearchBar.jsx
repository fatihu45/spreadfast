import React, { forwardRef, useId } from 'react';
import { Input, Button } from './primitives';
import UiIcon from './UiIcon';
import { cx } from './utils';

export default forwardRef(function SearchBar({ label = 'Search campaigns', id, value,
  onChange, onClear, disabled, className, placeholder = 'Search campaigns…', ...props }, ref) {
  const generatedId = useId();
  const inputId = id || `sf-search-${generatedId}`;
  return (
    <div className={cx('sf-search-bar', onClear && 'sf-search-bar--clearable', className)} role="search" aria-label={label}>
      <label className="sf-visually-hidden" htmlFor={inputId}>{label}</label>
      <UiIcon name="search" className="sf-search-bar__icon" />
      <Input {...props} ref={ref} id={inputId} type="search" value={value} onChange={onChange}
        disabled={disabled} placeholder={placeholder} className="sf-search-bar__input" />
      {onClear && value != null && String(value).length > 0 && <Button variant="ghost" disabled={disabled}
        className="sf-search-bar__clear" onClick={onClear} aria-label="Clear search"><UiIcon name="close" /></Button>}
    </div>
  );
});
