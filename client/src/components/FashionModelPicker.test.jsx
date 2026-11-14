/* eslint-disable testing-library/no-unnecessary-act -- React DOM createRoot tests. */
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import FashionModelPicker from './FashionModelPicker';
import models from '../data/fashionModels.json';
test('portraits are visible, selection collapses and another model can be chosen',()=>{
 global.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 function Demo(){const [value,set]=useState('');return <FashionModelPicker models={models} value={value} onChange={set}/>;}
 try{
  act(()=>root.render(<Demo/>));expect(host.querySelectorAll('.sf-model-grid img')).toHaveLength(6);
  for(const img of host.querySelectorAll('img')) expect(img.getAttribute('src')).toMatch(/\/studios\/models\/.*\.webp$/);
  act(()=>host.querySelector('.sf-model-grid button').click());
  expect(host.querySelector('.sf-model-grid')).toBeNull();expect(host.querySelector('.sf-model-summary strong').textContent).toBe('Amina');
  act(()=>host.querySelector('.sf-model-summary button').click());
  expect(host.querySelectorAll('.sf-model-grid button')).toHaveLength(6);
  act(()=>host.querySelectorAll('.sf-model-grid button')[1].click());
  expect(host.querySelector('.sf-model-summary strong').textContent).toBe('Umar');expect(host.querySelector('.sf-model-grid')).toBeNull();
 }finally{act(()=>root.unmount());host.remove();}
});
