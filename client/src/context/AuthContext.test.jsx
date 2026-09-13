import React from 'react';
import {createRoot} from 'react-dom/client';
import {act as oldAct} from 'react-dom/test-utils';
import {AuthContext,AuthProvider} from './AuthContext';
const act=React.act||oldAct;let host,root,context,originalFetch;
function Probe(){context=React.useContext(AuthContext);return <div>{context.user?.name||'signed out'}</div>;}
beforeEach(()=>{jest.useFakeTimers();global.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();sessionStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);originalFetch=global.fetch;global.fetch=jest.fn();jest.spyOn(console,'log').mockImplementation(()=>{});jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>{act(()=>root.unmount());host.remove();localStorage.clear();global.fetch=originalFetch;jest.useRealTimers();jest.restoreAllMocks();});
async function mount(){await act(async()=>root.render(<AuthProvider><Probe/></AuthProvider>));}
test('late validation cannot restore the logged-out user',async()=>{let finish;localStorage.setItem('token','old');global.fetch.mockImplementation(()=>new Promise(resolve=>finish=resolve));await mount();await act(async()=>context.logout());await act(async()=>finish({ok:true,status:200,json:async()=>({success:true,user:{name:'Old user'}})}));expect(context.user).toBeNull();expect(context.token).toBeNull();expect(jest.getTimerCount()).toBe(0);});
test('logout cancels scheduled validation retries',async()=>{localStorage.setItem('token','old');global.fetch.mockRejectedValue(Error('offline'));await mount();expect(global.fetch).toHaveBeenCalledTimes(1);await act(async()=>context.logout());await act(async()=>jest.advanceTimersByTime(600000));expect(global.fetch).toHaveBeenCalledTimes(1);expect(context.user).toBeNull();});
test.each(['login','register'])('%s keeps backend rejection details',async action=>{global.fetch.mockResolvedValue({ok:false,status:400,json:async()=>({message:'Specific account error'})});await mount();let result;await act(async()=>{result=action==='login'?await context.login('email','password'):await context.register('Name','email','password','promoter');});expect(result).toEqual({success:false,message:'Specific account error'});});
