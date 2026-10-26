'use client';

import Image from 'next/image';
import {useId,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Expand,X} from 'lucide-react';

export default function ProductGallery({images=[],name}){
 const [activeSource,setActiveSource]=useState(null),dialog=useRef(null),thumbnails=useRef([]),id=useId();
 const active=Math.max(0,images.findIndex(image=>image.src===activeSource));
 const image=images[active]??images[0];
 function select(index,focus=false){
  const next=(index+images.length)%images.length;setActiveSource(images[next]?.src??null);
  if(focus)thumbnails.current[next]?.focus();
 }
 function keyboard(event,focus=false){
  const next=event.key==='ArrowRight'?active+1:event.key==='ArrowLeft'?active-1:event.key==='Home'?0:event.key==='End'?images.length-1:null;
  if(next!=null){event.preventDefault();select(next,focus);}
 }
 if(!image)return <div className="pd-gallery-empty">No image is available for this configuration.</div>;
 return <div className="pd-gallery" aria-label={`${name} gallery`}>
  <button id={id} type="button" className="pd-main-image" aria-describedby={`${id}-caption`} aria-label={`Enlarge image of ${name}`} onClick={()=>dialog.current?.showModal()}>
   <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1024px) 48vw, 92vw" preload className="pd-contained-image" />
   <span className="pd-expand"><Expand size={17} aria-hidden="true" /> View larger</span>
  </button>
  <div className="pd-thumbnails" role="group" aria-label="Product image thumbnails" onKeyDown={event=>keyboard(event,true)}>
   {images.map((item,index)=><button key={item.id??item.src} ref={element=>{thumbnails.current[index]=element;}} type="button" className="pd-thumbnail" aria-label={`Show product image ${index+1}`} aria-pressed={active===index} aria-controls={id} onClick={()=>select(index)}>
    <Image src={item.src} alt="" fill sizes="72px" className="pd-contained-image" />
   </button>)}
  </div>
  <p id={`${id}-caption`} className="pd-image-caption" aria-live="polite">Image {active+1} of {images.length}{image.creditUrl?<> · <a href={image.creditUrl}>Image credits</a></>:null}</p>
  <dialog ref={dialog} className="pd-lightbox" aria-label={`Enlarged image of ${name}`} onKeyDown={event=>keyboard(event)} onClick={event=>{if(event.target===event.currentTarget)dialog.current.close();}}>
   <div className="pd-lightbox-toolbar"><span>Image {active+1} of {images.length}</span><button className="icon-button" type="button" aria-label="Close enlarged image" onClick={()=>dialog.current.close()} autoFocus><X aria-hidden="true" /></button></div>
   <div className="pd-lightbox-image"><Image src={image.src} alt={image.alt} fill sizes="90vw" className="pd-contained-image" /></div>
   {images.length>1?<div className="pd-lightbox-controls"><button type="button" className="pd-button-secondary" aria-label="Previous enlarged image" onClick={()=>select(active-1)}><ChevronLeft aria-hidden="true" size={18} /> Previous</button><button type="button" className="pd-button-secondary" aria-label="Next enlarged image" onClick={()=>select(active+1)}>Next <ChevronRight aria-hidden="true" size={18} /></button></div>:null}
  </dialog>
 </div>;
}
