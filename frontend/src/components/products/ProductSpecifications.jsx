import {getSpecificationGroups} from '@/lib/product-specifications';

export default function ProductSpecifications({category,specifications}){
 const groups=getSpecificationGroups(category,specifications);
 if(!groups.length)return null;
 return <div className="pd-specification-groups">{groups.map(group=><section className="pd-specification-group" key={group.title} aria-label={group.title}>
  <h3>{group.title}</h3><dl>{group.rows.map(row=><div className="pd-spec-row" key={row.key} data-spec-key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
 </section>)}</div>;
}
