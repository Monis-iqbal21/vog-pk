'use client';
import {useId,useState} from 'react';
import FilterGroup from './FilterGroup';

function PriceRange({min,max,onPrice}){
 const id=useId(),[lower,setLower]=useState(min??''),[upper,setUpper]=useState(max??''),[error,setError]=useState('');
 function submit(event){
  event.preventDefault();const a=lower===''?null:Number(lower),b=upper===''?null:Number(upper);
  if([a,b].some(value=>value!==null&&(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER))){setError('Enter non-negative prices in PKR.');return;}
  if(a!==null&&b!==null&&a>b){setError('Minimum price cannot exceed maximum price.');return;}
  setError('');onPrice(a,b);
 }
 return <form onSubmit={submit} className="pl-price-form" noValidate>
  <div className="pl-price-inputs"><label htmlFor={`${id}-min`}>Minimum<input id={`${id}-min`} type="number" inputMode="decimal" min="0" step="0.01" value={lower} onChange={event=>setLower(event.target.value)} placeholder="Any" /></label><label htmlFor={`${id}-max`}>Maximum<input id={`${id}-max`} type="number" inputMode="decimal" min="0" step="0.01" value={upper} onChange={event=>setUpper(event.target.value)} placeholder="Any" /></label></div>
  {error?<p className="pl-price-error" role="alert">{error}</p>:null}
  <button type="submit" className="pl-secondary-button">Apply price</button>
 </form>;
}
export default function ProductFilters({facets,state,priceReset=0,onToggle,onPrice,onClear}){
 return <div className="pl-filters"><div className="pl-filter-title"><h2>Filters</h2><button type="button" onClick={onClear}>Clear all</button></div>
  <details className="pl-filter-group" open><summary>Reference price (PKR)<span aria-hidden="true">+</span></summary><PriceRange key={`${state.min}:${state.max}:${priceReset}`} min={state.min} max={state.max} onPrice={onPrice} /><p className="pl-filter-note">Retailer references, not approved VOGPK offers.</p></details>
  {facets.map(facet=><FilterGroup key={facet.code} facet={facet} selected={state.filters[facet.code]} onToggle={onToggle} />)}
 </div>;
}
