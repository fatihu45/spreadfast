import React, { forwardRef } from 'react';
import { cx } from './utils';

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', fullWidth = false, type = 'button', className, ...props }, ref
) {
  return <button ref={ref} type={type} className={cx('sf-control sf-button', `sf-button--${variant}`, `sf-button--${size}`, fullWidth && 'sf-button--block', className)} {...props} />;
});

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx('sf-control sf-input', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx('sf-control sf-input', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cx('sf-control sf-input', className)} {...props} />;
});

export function Badge({ tone = 'neutral', className, ...props }) {
  return <span className={cx('sf-badge', `sf-badge--${tone}`, className)} {...props} />;
}

export function Card({ as: Component = 'div', variant = 'default', className, ...props }) {
  return <Component className={cx('sf-card', `sf-card--${variant}`, className)} {...props} />;
}

export function Container({ as: Component = 'div', className, ...props }) {
  return <Component className={cx('sf-container', className)} {...props} />;
}
