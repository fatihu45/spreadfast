import React from 'react';
import {createRoot} from 'react-dom/client';
import {act as oldAct} from 'react-dom/test-utils';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {AuthContext} from '../context/AuthContext';
import {apiCallAuth} from '../utils/api';
import PaymentCallback from './PaymentCallback';
jest.mock('../utils/api',()=>({apiCallAuth:jest.fn()}));
const act=React.act||oldAct;let host,root;
function Location(){const l=useLocation();return <output>{l.pathname+l.search}</output>;}
beforeEach(()=>{jest.useFakeTimers();global.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);sessionStorage.clear();apiCallAuth.mockReset().mockImplementation(async endpoint=>endpoint.endsWith('/verify')?{success:true}:{success:true,campaignCreated:true,campaign:{id:'paid'}});});
afterEach(()=>{act(()=>root.unmount());host.remove();jest.useRealTimers();});
async function render(route='/payment-callback?reference=paid',value={token:'valid',loading:false}){await act(async()=>root.render(<MemoryRouter initialEntries={[route]} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><AuthContext.Provider value={value}><PaymentCallback/><Location/></AuthContext.Provider></MemoryRouter>));}
test('missing reference shows an actionable error',async()=>{await render('/payment-callback');expect(host.textContent).toContain('reference is missing');expect(apiCallAuth).not.toHaveBeenCalled();});
test('confirms saved transaction without a session draft and redirects',async()=>{await render();await act(async()=>jest.advanceTimersByTime(1));expect(host.textContent).toContain('Payment Successful');expect(apiCallAuth).toHaveBeenCalledWith('/api/payments/campaign-status/paid','valid');expect(apiCallAuth.mock.calls.some(c=>c[0]==='/api/campaigns')).toBe(false);await act(async()=>jest.advanceTimersByTime(2000));expect(host.querySelector('output').textContent).toBe('/company?refresh=true');});
test('waits for authentication and retries when token becomes available',async()=>{await render(undefined,{token:null,loading:true});expect(apiCallAuth).not.toHaveBeenCalled();await render(undefined,{token:'restored',loading:false});expect(apiCallAuth.mock.calls[0][1]).toBe('restored');});
test('verification error can be retried without another payment',async()=>{apiCallAuth.mockResolvedValueOnce({success:false,message:'Temporary failure'});await render();expect(host.textContent).toContain('Temporary failure');await act(async()=>host.querySelector('button').click());await act(async()=>jest.advanceTimersByTime(1));expect(host.textContent).toContain('Payment Successful');expect(apiCallAuth.mock.calls.some(c=>c[0].includes('initiate'))).toBe(false);});
test('unmount cancels pending confirmation and redirect',async()=>{await render();act(()=>root.unmount());root=createRoot(host);await act(async()=>jest.advanceTimersByTime(600000));expect(apiCallAuth).toHaveBeenCalledTimes(1);});
