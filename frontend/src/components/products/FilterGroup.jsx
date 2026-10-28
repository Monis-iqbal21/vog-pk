'use client';
import {useState} from 'react';

export default function FilterGroup({facet,selected=[],onToggle}){
 const [search,setSearch]=useState('');
 const options=facet.values.filter(option=>option.label.toLowerCase().includes(search.toLowerCase().trim()));
 return <details className="pl-filter-group" data-filter-code={facet.code} open><summary>{facet.label}<span aria-hidden="true">+</span></summary>
  {facet.values.length>6?<input type="search" className="pl-filter-search" aria-label={`Search ${facet.label} options`} placeholder="Find an option" value={search} onChange={event=>setSearch(event.target.value)} />:null}
  <div className="pl-filter-options">{options.map(option=>{
   const checked=selected.includes(option.value),unavailable=option.count===0&&!checked;
   return <label key={option.value} title={unavailable?'No matches with the other selected filters':undefined} className={unavailable?'pl-unavailable':undefined}>
    <input type="checkbox" checked={checked} disabled={unavailable} onChange={()=>onToggle(facet.code,option.value)} /><span>{option.label}</span><span className="pl-facet-count">({option.count})</span>
   </label>;
  })}{!options.length?<p>No options match your search.</p>:null}</div>
 </details>;
}
