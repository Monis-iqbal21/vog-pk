import {ChevronLeft,ChevronRight} from 'lucide-react';
export default function ProductPagination({page,pageCount,onPage,hrefForPage}){
 if(pageCount<=1)return null;
 const numbers=[...new Set([1,pageCount,...[page-1,page,page+1].filter(value=>value>0&&value<=pageCount)])].sort((a,b)=>a-b);
 const link=(value,label,content)=>value<1||value>pageCount?<button type="button" disabled aria-label={label}>{content}</button>:<a href={hrefForPage(value)} aria-label={label} aria-current={value===page?'page':undefined} onClick={event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onPage(value);}}}>{content}</a>;
 return <nav className="pl-pagination" aria-label="Product pagination">{link(page-1,'Previous page',<ChevronLeft size={18} aria-hidden="true" />)}{numbers.map((value,index)=><span key={value}>{index&&value>numbers[index-1]+1?<span className="pl-page-gap" aria-hidden="true">…</span>:null}{link(value,`Page ${value}`,value)}</span>)}{link(page+1,'Next page',<ChevronRight size={18} aria-hidden="true" />)}<p>Page {page} of {pageCount}</p></nav>;
}
