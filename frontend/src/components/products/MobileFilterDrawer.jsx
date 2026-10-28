'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {SlidersHorizontal,X} from 'lucide-react';

export default function MobileFilterDrawer({children,total,activeCount}){
 const dialog=useRef(null),trigger=useRef(null),id=useId(),[open,setOpen]=useState(false);
 useEffect(()=>{
  if(!open)return;
  const old=document.body.style.overflow;document.body.style.overflow='hidden';
  const media=window.matchMedia('(min-width: 1280px)');
  const closeOnDesktop=()=>{if(media.matches)dialog.current?.close();};media.addEventListener('change',closeOnDesktop);
  return ()=>{document.body.style.overflow=old;media.removeEventListener('change',closeOnDesktop);};
 },[open]);
 return <><button ref={trigger} className="pl-filter-trigger pl-secondary-button" type="button" aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={()=>{dialog.current.showModal();setOpen(true);}}><SlidersHorizontal size={17} aria-hidden="true" /> Filters{activeCount?` (${activeCount})`:''}</button>
  <dialog ref={dialog} id={id} className="pl-filter-drawer" aria-labelledby={`${id}-title`} onClose={()=>{setOpen(false);trigger.current?.focus();}} onClick={event=>{if(event.target===event.currentTarget)dialog.current.close();}} onKeyDown={event=>{
   if(event.key!=='Tab')return;
   const controls=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href]')].filter(element=>element.getClientRects().length);
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }}>
   <div className="pl-drawer-heading"><h2 id={`${id}-title`}>Filter products</h2><button type="button" className="icon-button" aria-label="Close filters" onClick={()=>dialog.current.close()} autoFocus><X aria-hidden="true" /></button></div>
   <div className="pl-drawer-body">{children}</div>
   <div className="pl-drawer-footer"><button type="button" className="pl-primary-button" onClick={()=>dialog.current.close()}>View {total} results</button></div>
  </dialog></>;
}
