export const modules=[
 {path:'/dashboard',title:'Overview',permission:'dashboard.view',icon:'overview'},
 {path:'/products',title:'Products',permission:'products.view',icon:'products'},
 {path:'/attributes',title:'Attributes & Options',permission:'attributes.view',permissions:['attributes.view','option-sets.view'],scope:'TENANT',icon:'categories'},
 {path:'/product-types',title:'Product Types',permission:'product-types.view',scope:'TENANT',icon:'variants'},
 {path:'/categories',title:'Categories & Filters',permission:'categories.view',icon:'categories'},
 {path:'/variants',title:'Product Variants',permission:'variants.view',icon:'variants'},
 {path:'/media',title:'Images & Posters',permission:'media.view',icon:'media'},
 {path:'/homepage',title:'Homepage Content',permission:'homepage.view',icon:'homepage'},
 {path:'/coupons',title:'Coupons & Promotions',permission:'coupons.view',icon:'coupons'},
 {path:'/orders',title:'Orders',permission:'orders.view',icon:'orders'},
 {path:'/settings',title:'Store Settings',permission:'settings.view',icon:'settings'},
 {path:'/staff',title:'Staff & Roles',permission:'staff.view',icon:'staff'},
 {path:'/audit-logs',title:'Audit Logs',permission:'audit.view',icon:'audit'},
];
export const canOpenModule=(user,module)=>module.scope==='TENANT'?(user.schemaContexts??[]).some(c=>(module.permissions??[module.permission]).some(p=>c.permissions.includes(p))):user.permissions.includes(module.permission)||(module.path==='/dashboard'&&(user.schemaContexts??[]).length>0);
