import {optionStatusLabels} from '@/lib/product-options';

const safeColour=value=>typeof value==='string'&&/^#[\da-f]{3}([\da-f]{3})?$/i.test(value)?value:undefined;

export function OptionButtons({option,values,onSelect}){
 return <div className="pd-option-values">{values.map(({item,status,selected})=><button
  key={item.value} type="button" className={`pd-option${option.displayType==='swatch'?' pd-option-swatch':''}`}
  aria-pressed={selected} disabled={status==='not_offered'} data-option-status={status}
  aria-label={`${item.label} — ${optionStatusLabels[status]}`} onClick={()=>onSelect(option.code,item.value)}>
  {option.displayType==='swatch'?<span aria-hidden="true" className="pd-swatch" style={{backgroundColor:safeColour(item.swatch)??'transparent'}}>{selected?'✓':''}</span>:null}
  <span><span className="pd-option-label">{item.label}</span><span className="pd-option-status">{optionStatusLabels[status]}</span></span>
 </button>)}</div>;
}

export function OptionDropdown({option,values,onSelect}){
 const selected=values.find(value=>value.selected)?.item.value??'';
 return <select className="pd-option-dropdown" aria-label={option.label} value={selected} onChange={event=>{if(event.target.value)onSelect(option.code,event.target.value);}}>
  <option value="" disabled>Choose {option.label.toLowerCase()}</option>
  {values.map(({item,status})=><option key={item.value} value={item.value} disabled={status==='not_offered'}>{item.label} — {optionStatusLabels[status]}</option>)}
 </select>;
}
