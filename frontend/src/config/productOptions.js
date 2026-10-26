// Display defaults only; these never create merchandise choices or variants.
const common={color:{label:'Colour',displayType:'swatch'},edition:{label:'Edition'},capacity:{label:'Capacity'},size:{label:'Size'},connectivity:{label:'Connectivity'}};
export const categoryOptionTypes={
 keyboards:{switch:{label:'Switch Type'},layout:{label:'Keyboard Layout'}},
 'gaming-mice':{edition:{label:'Edition'}},'pc-cases':{panel:{label:'Panel Type'}},
 ram:{capacity:{label:'Capacity'}},controllers:{edition:{label:'Edition'}},
 accessories:{size:{label:'Size'},design:{label:'Design'}},
};
export function getOptionDisplay(category,option){
 const code=option.code??option.name;
 const defaults={...common[code],...categoryOptionTypes[category]?.[code]};
 return {code,label:option.label??defaults.label??code,displayType:option.displayType??defaults.displayType??(option.values?.length>7?'dropdown':'button')};
}
