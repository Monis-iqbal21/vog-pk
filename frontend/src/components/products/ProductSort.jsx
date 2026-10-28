import {listingSorts} from '@/lib/product-listings';
export default function ProductSort({value,onChange}){
 return <label className="pl-sort">Sort by<select aria-label="Sort products" value={value} onChange={event=>onChange(event.target.value)}>{listingSorts.map(([code,label])=><option value={code} key={code}>{label}</option>)}</select></label>;
}
