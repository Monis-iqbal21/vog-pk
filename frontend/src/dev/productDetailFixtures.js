// Test data is never merged into the catalogue. The route requires development
// mode AND VOG_ENABLE_DETAIL_FIXTURES=1; production always returns 404.
const media=(id,width,height)=>({id,src:`/dev/product-fixtures/media/${id}.svg`,alt:`Development layout fixture: ${id}; not a real product photograph`,width,height});
export const fixtureMedia={landscape:media('landscape',1200,500),portrait:media('portrait',500,1100),banner:media('banner',1600,400),poster:media('poster',600,1800),black:media('black',1000,700),white:media('white',1000,700),gray:media('gray',1000,700)};
export const fixtureProducts={keyboard:{
 id:'development-keyboard-fixture',slug:'development-keyboard-fixture',category:'keyboards',categoryName:'Keyboards',brand:'Development fixture',name:'Development fixture keyboard — fictional configurations for testing only',modelIdentifier:'TEST ONLY',manufacturerSku:'FIXTURE-BASE',shortDescription:'Isolated selector and media layout test. Not a real store product.',specifications:{layout:'Test layout',connectivity:'Test USB'},
 referencePricePKR:999,price:null,regularPrice:null,salePrice:null,pricingApproved:false,inventoryVerified:false,stock:null,sourceUrl:null,sourceCheckedAt:null,imageCreditUrl:null,imageDevelopmentOnly:false,
 gallery:[fixtureMedia.landscape,fixtureMedia.portrait],
 optionDefinitions:[{code:'color',values:[{value:'Black',swatch:'#111827'},{value:'White',swatch:'#ffffff'},{value:'Gray',swatch:'#94a3b8'}]},{code:'switch',values:['Red','Brown','Magnetic']}],
 variants:[
  {id:'fixture-black-red',sku:'FIXTURE-BLACK-RED',selections:{color:'Black',switch:'Red'},referencePricePKR:1000,price:900,pricingApproved:true,inventoryVerified:true,stock:3,images:[fixtureMedia.black],specifications:{color:'Black',switchModel:'Fixture Red'}},
  {id:'fixture-black-brown',sku:'FIXTURE-BLACK-BROWN',selections:{color:'Black',switch:'Brown'},pricePKR:1200,pricingApproved:true,inventoryVerified:true,stockQuantity:2,images:[fixtureMedia.black],specifications:{color:'Black',switchModel:'Fixture Brown'}},
  {id:'fixture-black-magnetic',sku:'FIXTURE-BLACK-MAGNETIC',selections:{color:'Black',switch:'Magnetic'},price:1800,regularPrice:1800,salePrice:1500,pricingApproved:true,promotionApproved:true,inventoryVerified:true,stock:4,images:[fixtureMedia.black],specifications:{color:'Black',switchModel:'Fixture Magnetic'}},
  {id:'fixture-white-brown',sku:'FIXTURE-WHITE-BROWN',selections:{color:'White',switch:'Brown'},referencePricePKR:2000,pricingApproved:false,inventoryVerified:false,stock:null,availability:'unconfirmed',images:[fixtureMedia.white],specifications:{color:'White',switchModel:'Fixture Brown'}},
  {id:'fixture-white-magnetic',sku:'FIXTURE-WHITE-MAGNETIC',selections:{color:'White',switch:'Magnetic'},price:2500,pricingApproved:true,inventoryVerified:true,stock:2,images:[fixtureMedia.white,fixtureMedia.portrait],specifications:{color:'White',switchModel:'Fixture Magnetic'}},
  {id:'fixture-gray-magnetic',sku:'FIXTURE-GRAY-MAGNETIC',selections:{color:'Gray',switch:'Magnetic'},price:3000,pricingApproved:true,inventoryVerified:true,stock:0,availability:'out_of_stock',images:[fixtureMedia.gray],specifications:{color:'Gray',switchModel:'Fixture Magnetic'}},
 ],
 overview:'Development-only fixture for supported combinations and media aspect ratios.',features:[],warranty:null,delivery:null,
 contentBlocks:[
  {id:'fixture-text',type:'featureText',title:'Feature text fixture',description:'Test text only.'},
  {id:'fixture-list',type:'featureList',title:'Feature list fixture',items:['First test feature','Second test feature']},
  {id:'fixture-image-text',type:'imageText',title:'Image and text fixture',description:'Landscape media must retain its source ratio.',image:fixtureMedia.landscape},
  {id:'fixture-banner',type:'wideBanner',image:fixtureMedia.banner,caption:'Development banner fixture, 4:1 ratio.'},
  {id:'fixture-poster',type:'verticalPoster',image:fixtureMedia.poster,caption:'Development poster fixture, 1:3 ratio.'},
  {id:'fixture-specs',type:'specifications',title:'Specification block fixture',specifications:{layout:'Test layout'}},
 ],
}};

// Original geometric media remains explicitly test artwork, never store photos.
const shared={brand:'Development fixture',modelIdentifier:'TEST ONLY',manufacturerSku:null,shortDescription:'Isolated variant fixture. Not real merchandise.',specifications:{},referencePricePKR:null,price:null,pricingApproved:false,inventoryVerified:false,stock:null,sourceUrl:null,sourceCheckedAt:null,imageCreditUrl:null,imageDevelopmentOnly:false,gallery:[fixtureMedia.landscape],overview:'Fictional configurations for development tests only.',features:[],contentBlocks:[],warranty:null,delivery:null};
fixtureProducts.mouse={...shared,id:'development-mouse-fixture',slug:'development-mouse-fixture',category:'gaming-mice',categoryName:'Gaming Mice',name:'Development fixture mouse — fictional configurations for testing only',
 optionDefinitions:[{code:'color',values:[{value:'Black',swatch:'#111827'},{value:'White',swatch:'#ffffff'}]}],
 variants:[
  {id:'fixture-mouse-black',sku:'FIXTURE-MOUSE-BLACK',selections:{color:'Black'},referencePricePKR:4000,inventoryVerified:false,stock:null,images:[fixtureMedia.black],specifications:{color:'Black'}},
  {id:'fixture-mouse-white',sku:'FIXTURE-MOUSE-WHITE',selections:{color:'White'},referencePricePKR:4500,inventoryVerified:false,stock:null,images:[fixtureMedia.white],specifications:{color:'White'}},
 ],
};
fixtureProducts.case={...shared,id:'development-case-fixture',slug:'development-case-fixture',category:'pc-cases',categoryName:'PC Cases',name:'Development fixture PC case — fictional configurations for testing only',
 optionDefinitions:[{code:'color',values:[{value:'Black',swatch:'#111827'},{value:'White',swatch:'#ffffff'}]},{code:'panel',values:['Mesh','Glass']},{code:'size',displayType:'dropdown',values:['Compact','Full']}],
 variants:[
  {id:'fixture-case-black-mesh-compact',sku:'FIXTURE-CASE-BMC',selections:{color:'Black',panel:'Mesh',size:'Compact'},price:6000,pricingApproved:true,stockQuantity:2,inventoryVerified:true,images:[fixtureMedia.black],specifications:{panel:'Mesh',size:'Compact',color:'Black'}},
  {id:'fixture-case-black-mesh-full',sku:'FIXTURE-CASE-BMF',selections:{color:'Black',panel:'Mesh',size:'Full'},price:7000,pricingApproved:true,stock:0,inventoryVerified:true,images:[fixtureMedia.black],specifications:{panel:'Mesh',size:'Full',color:'Black'}},
  {id:'fixture-case-black-glass-compact',sku:'FIXTURE-CASE-BGC',selections:{color:'Black',panel:'Glass',size:'Compact'},price:8000,pricingApproved:true,stock:3,inventoryVerified:true,images:[fixtureMedia.black],specifications:{panel:'Glass',size:'Compact',color:'Black'}},
  {id:'fixture-case-white-glass-full',sku:'FIXTURE-CASE-WGF',selections:{color:'White',panel:'Glass',size:'Full'},referencePricePKR:9000,inventoryVerified:false,stock:null,images:[fixtureMedia.white],specifications:{panel:'Glass',size:'Full',color:'White'}},
 ],
};
