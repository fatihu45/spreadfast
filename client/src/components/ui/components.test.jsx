import React, { createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct, Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { AppShell, Button, CampaignCard, CampaignStatusBadge, FormField, Input,
  SearchBar, StatCard, UserAvatar, WalletBalanceCard } from './index';

// React 18.3+ exposes act directly; retain compatibility with the declared 18.2 range.
const act = React.act || legacyAct;
let host;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(element, path = '/') {
  act(() => root.render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {element}
    </MemoryRouter>
  ));
}

test('shell preserves supplied destinations and active state on both navigation surfaces', () => {
  const logout = jest.fn();
  const action = <Button onClick={logout}>Sign out</Button>;
  render(<AppShell navigation={[
    { label: 'Campaigns', to: '/available-campaigns' },
    { label: 'Wallet', to: '/wallet' },
  ]} sidebarFooter={action} mobileActions={action}>
    <h1>Content</h1>
  </AppShell>, '/wallet');
  const navs = host.querySelectorAll('nav');
  expect(navs.length).toBe(2);
  navs.forEach(nav => {
    expect(nav.querySelector('[aria-current="page"]').getAttribute('href')).toBe('/wallet');
    expect([...nav.querySelectorAll('a')].map(link => link.getAttribute('href')))
      .toEqual(['/available-campaigns', '/wallet']);
  });
  expect(host.querySelector('.sf-skip-link').getAttribute('href')).toBe(`#${host.querySelector('main').id}`);
  act(() => host.querySelector('.sf-mobile-navigation button').click());
  expect(logout).toHaveBeenCalledTimes(1);
});

test('field connects label, help and errors without losing refs, handlers or native constraints', () => {
  const onChange = jest.fn();
  const ref = createRef();
  render(<>
    <p id="existing-help">Existing help</p>
    <FormField label="Amount" hint="Enter the requested amount" error="Check this amount">
      <Input ref={ref} id="amount" value="0" onChange={onChange} required min="0"
        type="number" aria-describedby="existing-help" />
    </FormField>
  </>);
  const input = host.querySelector('input');
  expect(ref.current).toBe(input);
  expect(host.querySelector('label').htmlFor).toBe(input.id);
  expect(input.required).toBe(true);
  expect(input.min).toBe('0');
  expect(input.value).toBe('0');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  input.getAttribute('aria-describedby').split(' ').forEach(id => expect(document.getElementById(id)).not.toBeNull());
  act(() => Simulate.change(input, { target: { value: '10' } }));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('generated field IDs are unique and existing invalid state is preserved', () => {
  render(<><FormField label="First"><Input aria-invalid="true" /></FormField><FormField label="Second" /></>);
  const inputs = host.querySelectorAll('input');
  expect(inputs[0].id).not.toBe(inputs[1].id);
  expect(inputs[0].getAttribute('aria-invalid')).toBe('true');
});

test('search forwards edits and clear action without submitting its parent form', () => {
  const onChange = jest.fn();
  const onClear = jest.fn();
  const onSubmit = jest.fn(event => event.preventDefault());
  render(<form onSubmit={onSubmit}><SearchBar value="query" onChange={onChange} onClear={onClear} /></form>);
  const input = host.querySelector('input');
  expect(host.querySelector('label').htmlFor).toBe(input.id);
  act(() => Simulate.change(input, { target: { value: 'new query' } }));
  act(() => host.querySelector('button').click());
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onClear).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
});

test('buttons preserve opt-in submission and disabled behavior', () => {
  const submit = jest.fn(event => event.preventDefault());
  const click = jest.fn();
  render(<form onSubmit={submit}><Button>Action</Button><Button type="submit">Submit</Button><Button disabled onClick={click}>Disabled</Button></form>);
  const buttons = host.querySelectorAll('button');
  act(() => buttons[0].click());
  expect(submit).not.toHaveBeenCalled();
  act(() => buttons[1].click());
  expect(submit).toHaveBeenCalledTimes(1);
  act(() => buttons[2].click());
  expect(click).not.toHaveBeenCalled();
});

test('cards distinguish zero, missing and loading values without inventing data', () => {
  render(<><StatCard label="Count" value={0} /><StatCard label="Missing" />
    <WalletBalanceCard balance={0} /><WalletBalanceCard loading balance="private value" /></>);
  expect([...host.querySelectorAll('dd')].map(node => node.textContent)).toEqual(['0', '—', '0', 'Loading…']);
  expect(host.textContent).not.toContain('private value');
  expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
});

test('campaign card keeps caller data, actions and routes; unknown statuses are not active', () => {
  const join = jest.fn();
  render(<><CampaignCard title="API title" description="API description" budget={0}
    platforms={['twitter', 'youtube']} status="paused" to="/available-campaigns"
    actions={<Button onClick={join}>Join</Button>} />
    <CampaignStatusBadge status="archived" /><CampaignStatusBadge /></>);
  expect(host.querySelector('article h3').textContent).toBe('API title');
  expect(host.querySelector('article a').getAttribute('href')).toBe('/available-campaigns');
  expect(host.querySelector('article dd').textContent).toBe('0');
  expect(host.textContent).toContain('X (Twitter)');
  expect(host.textContent).toContain('Archived');
  expect(host.textContent).toContain('Unknown');
  act(() => host.querySelector('button').click());
  expect(join).toHaveBeenCalledTimes(1);
});

test('avatar falls back on image failure and retries when the source changes', () => {
  render(<UserAvatar name="Test Person" src="/first.png" />);
  act(() => Simulate.error(host.querySelector('img')));
  expect(host.querySelector('img')).toBeNull();
  expect(host.textContent).toBe('TP');
  render(<UserAvatar name="Test Person" src="/second.png" />);
  expect(host.querySelector('img').getAttribute('src')).toBe('/second.png');
  render(<UserAvatar name={null} />);
  expect(host.querySelector('[role="img"]').getAttribute('aria-label')).toBe('User');
});
