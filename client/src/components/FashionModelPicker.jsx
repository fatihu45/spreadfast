import React, { useRef, useState } from 'react';
import './FashionModelPicker.css';
export default function FashionModelPicker({ models, value, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const changeRef = useRef(null);
  const selected = models.find(model => model.id === value);
  const choose = id => { onChange(id); setExpanded(false); requestAnimationFrame(()=>changeRef.current?.focus()); };
  return <div className="sf-model-picker">
    <h3>Choose your model</h3>
    <p>Six AI models. Tap a photo to choose.</p>
    {selected && <div className="sf-model-summary">
      <img src={selected.image} alt={selected.label} width="44" height="56" />
      <span><strong>{selected.label}</strong><small>Your selected model</small></span>
      <button ref={changeRef} type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Done':'Change model'}</button>
    </div>}
    {(!selected || expanded) && <div className="sf-model-grid" aria-label="Fashion models">
      {models.map(model=><button key={model.id} type="button" aria-pressed={value===model.id} onClick={()=>choose(model.id)}>
        <img src={model.image} alt={`${model.label}, ${model.description || 'fashion model'}`} width="240" height="360" loading="lazy" />
        <strong>{model.label}</strong><small>{model.description}</small>
      </button>)}
    </div>}
  </div>;
}
