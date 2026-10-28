import {X} from 'lucide-react';
export default function ActiveFilterChips({facets,state,onRemove,onClear}){
 const chips=facets.flatMap(facet=>(state.filters[facet.code]??[]).map(value=>({code:facet.code,value,label:`${facet.label}: ${facet.values.find(option=>option.value===value)?.label??value}`})));
 if(state.min!==null)chips.push({code:'min',label:`Min: Rs. ${state.min.toLocaleString('en-PK')}`});
 if(state.max!==null)chips.push({code:'max',label:`Max: Rs. ${state.max.toLocaleString('en-PK')}`});
 if(!chips.length)return null;
 return <div className="pl-active-filters" aria-label="Active filters">{chips.map(chip=><button type="button" key={`${chip.code}:${chip.value??''}`} aria-label={`Remove ${chip.label}`} onClick={()=>onRemove(chip.code,chip.value)}>{chip.label}<X size={13} aria-hidden="true" /></button>)}<button type="button" className="pl-clear" onClick={onClear}>Clear filters</button></div>;
}
