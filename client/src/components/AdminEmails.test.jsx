import React from 'react';
import {createRoot} from 'react-dom/client';
import {act as legacyAct} from 'react-dom/test-utils';
import {AuthContext} from '../context/AuthContext';
import AdminEmails from './AdminEmails';
const act=React.act || legacyAct;
let root,host;
const starter={subject:'Test subject',title:'Test headline',body:'Test message',cta:'Create ad',url:'https://tryspreadfast.com',imageUrl:'',audience:'all'};
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);global.fetch=jest.fn(async(url,options)=>({ok:true,json:async()=>url.endsWith('/preview')?{success:true,html:'<h1>Preview</h1>'}:{success:true,starter,settings:{enabled:false,frequency:3,hour:8},campaigns:[],tests:[],configured:true}}));});
afterEach(()=>{act(()=>root.unmount());host.remove();jest.restoreAllMocks();});
async function render(){await act(async()=>root.render(<AuthContext.Provider value={{token:'test-token'}}><AdminEmails/></AuthContext.Provider>));}
test('loads a paused schedule without sending emails',async()=>{await render();expect(host.textContent).toContain('Weekly schedule');expect(host.querySelector('input[type="checkbox"]').checked).toBe(false);expect(global.fetch).toHaveBeenCalledTimes(1);expect(global.fetch.mock.calls[0][1].method).toBe('GET');});
test('preview is sandboxed and never requests a send',async()=>{await render();const button=[...host.querySelectorAll('button')].find(b=>b.textContent==='Preview');await act(async()=>button.click());expect(host.querySelector('iframe').getAttribute('sandbox')).toBe('');expect(global.fetch.mock.calls.some(([url])=>url.endsWith('/test'))).toBe(false);});
