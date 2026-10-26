import {getActiveVariants,getOptionDefinitions,getOptionValueState} from '@/lib/product-options';
import {OptionButtons,OptionDropdown} from './OptionValueControl';

export default function ProductOptions({product,selections,onSelect}){
 const options=getOptionDefinitions(product);
 if(getActiveVariants(product).length<2||!options.length)return null;
 return <div className="pd-options">{options.map(option=>{
  const values=option.values.map(item=>({item,status:getOptionValueState(product,selections,option.code,item.value).status,selected:selections[option.code]===item.value}));
  const chosen=values.find(value=>value.selected)?.item.label;
  return <fieldset key={option.code} className="pd-option-group" data-option-code={option.code}><legend>{option.label}{chosen?<span className="pd-chosen-option">: {chosen}</span>:null}</legend>
   {option.displayType==='dropdown'?<OptionDropdown option={option} values={values} onSelect={onSelect} />:<OptionButtons option={option} values={values} onSelect={onSelect} />}
  </fieldset>;
 })}</div>;
}
