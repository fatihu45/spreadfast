import React from 'react';
import {createRoot} from 'react-dom/client';
import {act as legacyAct, Simulate} from 'react-dom/test-utils';
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

test('image field uploads a file, previews it and can remove it',async()=>{
  await render();expect(host.textContent).not.toContain('Image URL');
  const original=global.fetch.getMockImplementation();
  global.fetch.mockImplementation(async(url,options)=>url.endsWith('/images')?{ok:true,json:async()=>({success:true,imageUrl:'https://res.cloudinary.com/test/email.png'})}:original(url,options));
  const timeout=AbortSignal.timeout;AbortSignal.timeout=()=>undefined;
  try {
    const file=new File(['image'],'photo.png',{type:'image/png'});
    await act(async()=>Simulate.change(host.querySelector('input[type="file"]'),{target:{files:[file],value:'photo.png'}}));
    const upload=global.fetch.mock.calls.find(([url])=>url.endsWith('/images'));
    expect(upload[1].body).toBeInstanceOf(FormData);expect(upload[1].headers['Content-Type']).toBeUndefined();
    expect(host.querySelector('img[alt="Selected email artwork"]').src).toBe('https://res.cloudinary.com/test/email.png');
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Remove image').click());
    expect(host.querySelector('img[alt="Selected email artwork"]')).toBeNull();
  } finally {AbortSignal.timeout=timeout;}
});

test('saved draft can send now without enabling the weekly schedule',async()=>{
  const original=global.fetch.getMockImplementation();
  global.fetch.mockImplementation(async(url,options)=>{
    const response=await original(url,options);const data=await response.json();
    return {...response,json:async()=>({...data,campaigns:[{_id:'campaign1',subject:'Milestone',status:'draft',audience:'registered'}]})};
  });
  await render();expect(host.textContent).toContain('All signed-up users');
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Send now').click());
  expect(global.fetch.mock.calls.filter(([url])=>url.endsWith('/campaigns/campaign1/send'))).toHaveLength(1);
  expect(global.fetch.mock.calls.some(([url])=>url.endsWith('/settings'))).toBe(false);
});
