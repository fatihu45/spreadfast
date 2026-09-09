import React from 'react';
import { NavLink } from 'react-router-dom';
import { cx } from './utils';

// Routes and role-specific visibility are supplied by the caller.
export default function NavigationItems({ items }) {
  return (
    <ul className="sf-navigation-items">
      {items.map(item => (
        <li key={item.id || item.to}>
          <NavLink to={item.to} end={item.end ?? true}
            className={({ isActive }) => cx('sf-navigation-link', isActive && 'sf-navigation-link--active')}>
            {item.icon && <span className="sf-navigation-icon" aria-hidden="true">{item.icon}</span>}
            <span>{item.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
