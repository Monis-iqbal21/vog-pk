import {productSpecificationGroups} from '../config/productSpecifications.js';

function displayValue(value){
 if(value==null||value==='')return null;
 if(Array.isArray(value))return value.length?value.join(', '):null;
 if(typeof value==='object')return null;
 return typeof value==='boolean'?(value?'Yes':'No'):String(value);
}

export function getSpecificationGroups(category,specifications={}){
 const used=new Set();
 const groups=(productSpecificationGroups[category]??[]).map(group=>({title:group.title,rows:group.fields.flatMap(field=>{
  const key=field.keys.find(key=>displayValue(specifications[key])!=null);
  if(!key)return [];
  used.add(key);return [{key,label:field.label,value:displayValue(specifications[key])}];
 })})).filter(group=>group.rows.length);
 const extra=Object.entries(specifications).filter(([key,value])=>!used.has(key)&&displayValue(value)!=null).map(([key,value])=>({key,label:key,value:displayValue(value)}));
 if(extra.length)groups.push({title:'Additional details',rows:extra});
 return groups;
}
