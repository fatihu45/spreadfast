import React, { Children, cloneElement, useId } from 'react';
import { Input } from './primitives';
import { cx } from './utils';

export default function FormField({ label, id, hint, error, required, children = <Input />, className }) {
  const generatedId = useId();
  const control = Children.only(children);
  const controlId = id || control.props.id || `sf-field-${generatedId}`;
  const isRequired = required ?? control.props.required;
  const describedBy = [control.props['aria-describedby'], hint && `${controlId}-hint`, error && `${controlId}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('sf-field', className)}>
      <label className="sf-label" htmlFor={controlId}>{label}{isRequired && <span aria-hidden="true"> *</span>}</label>
      {cloneElement(control, { id: controlId, required: isRequired,
        'aria-describedby': describedBy, 'aria-invalid': error ? true : control.props['aria-invalid'] })}
      {hint && <p id={`${controlId}-hint`} className="sf-help">{hint}</p>}
      {error && <p id={`${controlId}-error`} className="sf-field-error" role="alert">{error}</p>}
    </div>
  );
}
