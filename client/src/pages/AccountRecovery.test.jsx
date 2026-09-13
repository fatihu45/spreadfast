import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
const act=React.act||legacyAct;
jest.setTimeout(30000);
let host,root,originalFetch;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);originalFetch=global.fetch;global.fetch=jest.fn().mockResolvedValue({json:async()=>({success:true,message:'Check your email'})});});
afterEach(()=>{act(()=>root.unmount());host.remove();global.fetch=originalFetch;window.history.replaceState({},'', '/');});
async function render(Page){await act(async()=>root.render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Page/></MemoryRouter>));}
function fill(input,value){act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
async function submit(){await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
test('recovery sends the same email request and displays its result',async()=>{await render(ForgotPassword);fill(host.querySelector('input'),'creator@example.com');await submit();const[url,options]=global.fetch.mock.calls[0];expect(url).toMatch(/\/api\/auth\/forgot-password$/);expect(options.method).toBe('POST');expect(options.credentials).toBe('include');expect(JSON.parse(options.body)).toEqual({email:'creator@example.com'});expect(host.querySelector('[role="status"]').textContent).toContain('Check your email');expect(host.querySelector('a[href="/login"]')).not.toBeNull();});
test('reset keeps token extraction, password matching, and the existing payload',async()=>{window.history.replaceState({},'', '/reset-password?token=review-token');await render(ResetPassword);const inputs=host.querySelectorAll('input');fill(inputs[0],'password123');fill(inputs[1],'different123');await submit();expect(global.fetch).not.toHaveBeenCalled();expect(host.textContent).toContain('Passwords do not match.');fill(inputs[1],'password123');await submit();const[url,options]=global.fetch.mock.calls[0];expect(url).toMatch(/\/api\/auth\/reset-password$/);expect(JSON.parse(options.body)).toEqual({token:'review-token',newPassword:'password123'});expect(options.credentials).toBe('include');expect(host.textContent).toContain('Your password has been reset successfully.');});
test('missing reset token leaves submission disabled',async()=>{await render(ResetPassword);expect(host.querySelector('button[type="submit"]').disabled).toBe(true);expect(host.querySelector('[role="alert"]').textContent).toContain('missing a token');});
