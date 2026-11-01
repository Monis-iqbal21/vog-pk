export const modules=[
 {path:'/dashboard',title:'Overview',permission:'dashboard.view',icon:'overview'},
 {path:'/products',title:'Products',permission:'products.view',scope:'CATALOG',icon:'products'},
 {path:'/attributes',title:'Attributes & Options',permission:'attributes.view',permissions:['attributes.view','option-sets.view'],scope:'TENANT',icon:'categories'},
 {path:'/product-types',title:'Product Types',permission:'product-types.view',scope:'TENANT',icon:'variants'},
 {path:'/categories',title:'Categories & Filters',permission:'categories.view',permissions:['categories.view','category-filters.view'],scope:'STORE',icon:'categories'},
 {path:'/variants',title:'Product Variants',permission:'products.view',scope:'CATALOG',icon:'variants'},
 {path:'/listings',title:'Store Listings',permission:'listings.view',scope:'STORE',icon:'products'},
 {path:'/media',title:'Images & Posters',permission:'media.view',icon:'media'},
 {path:'/homepage',title:'Homepage Content',permission:'homepage.view',icon:'homepage'},
 {path:'/coupons',title:'Coupons & Promotions',permission:'coupons.view',icon:'coupons'},
 {path:'/orders',title:'Orders',permission:'orders.view',icon:'orders'},
 {path:'/settings',title:'Store Settings',permission:'settings.view',icon:'settings'},
 {path:'/staff',title:'Staff & Roles',permission:'staff.view',icon:'staff'},
 {path:'/audit-logs',title:'Audit Logs',permission:'audit.view',icon:'audit'},
];
export const canOpenModule=(user,module)=>module.scope==='CATALOG'?(user.productContexts??[]).some(c=>c.permissions.includes(module.permission)):module.scope==='TENANT'?(user.schemaContexts??[]).some(c=>(module.permissions??[module.permission]).some(p=>c.permissions.includes(p))):module.scope==='STORE'?(user.catalogContexts??[]).some(c=>(module.permissions??[module.permission]).some(p=>c.permissions.includes(p))):user.permissions.includes(module.permission)||(module.path==='/dashboard'&&((user.schemaContexts??[]).length>0||(user.catalogContexts??[]).length>0||(user.productContexts??[]).length>0));
