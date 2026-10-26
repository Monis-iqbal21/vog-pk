import Image from 'next/image';
import ProductSpecifications from './ProductSpecifications';

function blockImage(block){
 const image=typeof block.image==='string'?{src:block.image,alt:block.alt,width:block.width,height:block.height}:block.image;
 return image?.src?.startsWith('/')&&!image.src.startsWith('//')&&image.width>0&&image.height>0?image:null;
}
function RichImage({image}){
 return <Image src={image.src} alt={image.alt??''} width={image.width} height={image.height} sizes="(min-width: 1024px) 1100px, 92vw" className="pd-rich-image" />;
}
export default function ProductContentBlocks({blocks=[],category}){
 return blocks.map((block,index)=>{
  const key=block.id??`${block.type}-${index}`,image=blockImage(block);
  switch(block.type){
   case 'featureText':return block.title||block.description?<section key={key} className="pd-content-block"><h3>{block.title}</h3><p>{block.description}</p></section>:null;
   case 'featureList':return block.items?.length?<section key={key} className="pd-content-block">{block.title?<h3>{block.title}</h3>:null}<ul>{block.items.map((item,i)=><li key={i}>{item}</li>)}</ul></section>:null;
   case 'imageText':return image?<section key={key} className="pd-content-block pd-image-text"><RichImage image={image} /><div>{block.title?<h3>{block.title}</h3>:null}{block.description?<p>{block.description}</p>:null}</div></section>:null;
   case 'wideBanner':case 'verticalPoster':return image?<figure key={key} className={`pd-content-block ${block.type==='verticalPoster'?'pd-poster':'pd-banner'}`}><RichImage image={image} />{block.caption?<figcaption>{block.caption}</figcaption>:null}</figure>:null;
   case 'specifications':return block.specifications?<section key={key} className="pd-content-block">{block.title?<h3>{block.title}</h3>:null}<ProductSpecifications category={category} specifications={block.specifications} /></section>:null;
   default:return null;
  }
 });
}
