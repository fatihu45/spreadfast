import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { cx } from './utils';

// Routes, actions, and role-specific visibility are supplied by the caller.
export default function NavigationItems({ items }) {
  return <ul className="sf-navigation-items">
    {items.map(item => {
      const content = <>{item.icon && <span className="sf-navigation-icon" aria-hidden="true">{item.icon}</span>}<span>{item.label}</span></>;
      return <li key={item.id || item.to}>
        {item.to && typeof item.active === 'boolean' ? <Link to={item.to}
          aria-current={item.active ? 'page' : undefined}
          className={cx('sf-navigation-link', item.active && 'sf-navigation-link--active')}>{content}</Link>
          : item.to ? <NavLink to={item.to} end={item.end ?? true}
          aria-current={item.active === false ? false : undefined}
          className={({ isActive }) => cx('sf-navigation-link', (item.active ?? isActive) && 'sf-navigation-link--active')}>
          {content}
        </NavLink> : <button type="button" className={cx('sf-navigation-link', item.active && 'sf-navigation-link--active')} aria-current={item.active ? 'page' : undefined} onClick={item.onClick} disabled={item.disabled} title={item.title}>
          {content}
        </button>}
      </li>;
    })}
  </ul>;
}
