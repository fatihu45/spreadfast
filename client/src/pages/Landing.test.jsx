import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct, Simulate } from 'react-dom/test-utils';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Landing from './Landing';

const act = React.act || legacyAct;
let host;
let root;

function LocationView() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}
function render(user = null) {
  act(() => root.render(<AuthContext.Provider value={{ user }}>
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Landing /><LocationView />
    </MemoryRouter>
  </AuthContext.Provider>));
}
function clickCTA(text) {
  const button = [...host.querySelectorAll('button')].find(node => node.textContent.startsWith(text));
  act(() => button.click());
}
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.restoreAllMocks();
});

test.each([
  [null, 'Start a Campaign', '/register?role=company'],
  [null, 'Earn with SpreadFast', '/register?role=promoter'],
  [{ role: 'company', name: 'Test business' }, 'Start a Campaign', '/company'],
  [{ role: 'promoter', name: 'Test creator' }, 'Earn with SpreadFast', '/dashboard'],
])('preserves the role-aware CTA destination (%s, %s)', (user, text, destination) => {
  render(user);
  clickCTA(text);
  expect(host.querySelector('[data-testid="location"]').textContent).toBe(destination);
});

test.each([
  [{ role: 'company' }, 'Earn with SpreadFast', 'Please login as a promoter to join campaigns.'],
  [{ role: 'promoter' }, 'Start a Campaign', 'Only companies can create campaigns. Please login as a company.'],
])('preserves wrong-role feedback (%s)', (user, text, message) => {
  render(user);
  clickCTA(text);
  expect(window.alert).toHaveBeenCalledWith(message);
  expect(host.querySelector('[data-testid="location"]').textContent).toBe('/');
});

test('keeps header destinations, existing support links and working section anchors', () => {
  render();
  const links = [...host.querySelectorAll('a')].map(node => node.getAttribute('href'));
  ['/login', '/register', '#pricing', '#faq', '#', 'https://wa.me/+2349071023617',
    'https://chat.whatsapp.com/LQey4iZk9Hn2RSEg8DcLvr?mode=gi_t'].forEach(href => expect(links).toContain(href));
  links.filter(href => href.startsWith('#') && href !== '#').forEach(href => {
    expect(document.getElementById(href.slice(1))).not.toBeNull();
  });
  expect(host.querySelectorAll('h1')).toHaveLength(1);
  expect(host.querySelector('h1').textContent.replace(/\s+/g, ' ')).toBe('Get more customers. Grow your Business.');
});

test('mobile navigation opens and closes by Escape with focus restored', () => {
  render();
  const toggle = host.querySelector('[aria-controls="landing-navigation"]');
  act(() => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  act(() => Simulate.keyDown(host.querySelector('header'), { key: 'Escape' }));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(toggle);
});

test('FAQ accordion retains its answers and accessible expansion state', () => {
  render();
  const button = host.querySelector('#faq-question-0');
  const answer = host.querySelector('#faq-answer-0');
  expect(answer.hidden).toBe(true);
  act(() => button.click());
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(answer.hidden).toBe(false);
  expect(answer.textContent).toContain('Every promoter submission is tracked');
  act(() => button.click());
  expect(answer.hidden).toBe(true);
});
