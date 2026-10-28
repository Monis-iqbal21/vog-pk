export const PERMISSIONS=[
 'dashboard.view','products.view','products.create','products.update','products.publish','products.archive',
 'categories.view','categories.manage','variants.view','variants.manage','media.view','media.manage',
 'inventory.view','inventory.manage','homepage.view','homepage.manage','coupons.view','coupons.manage',
 'orders.view','orders.manage','settings.view','settings.manage','staff.view','staff.manage','roles.view','roles.manage','audit.view',
] as const;
const read=(...modules:string[])=>modules.map(module=>`${module}.view`);
export const ROLE_DEFINITIONS=[
 {code:'SUPER_ADMIN',name:'Owner / Super Admin',description:'Complete platform administration.',permissions:[...PERMISSIONS]},
 {code:'STORE_MANAGER',name:'Store Manager',description:'Catalogue, inventory, fulfilment and marketing operations; no staff or security administration.',permissions:PERMISSIONS.filter(code=>!['staff','roles','audit'].includes(code.split('.')[0])&&code!=='settings.manage')},
 {code:'CATALOG_MANAGER',name:'Catalogue Manager',description:'Catalogue, images, attributes and variants.',permissions:['dashboard.view',...PERMISSIONS.filter(code=>['products','categories','variants','media'].includes(code.split('.')[0]))]},
 {code:'ORDER_MANAGER',name:'Order Manager',description:'Order and delivery operations; no refunds or payment changes.',permissions:['dashboard.view','orders.view','orders.manage']},
 {code:'MARKETING_MANAGER',name:'Marketing Manager',description:'Homepage, collections and promotions.',permissions:['dashboard.view',...read('homepage','coupons','media'),'homepage.manage','coupons.manage','media.manage']},
 {code:'VIEWER',name:'Viewer',description:'Read-only access to assigned operational modules.',permissions:read('dashboard','products','categories','variants','media','inventory','homepage','coupons','orders')},
];
export const userGraph={roles:{include:{role:{include:{permissions:{include:{permission:true}}}}}}} as const;
export type AuthIdentity={id:string;name:string;email:string;active:boolean;roles:{code:string;name:string}[];permissions:string[]};
type UserRecord={id:string;name:string;email:string;active:boolean;roles:{role:{code:string;name:string;permissions:{permission:{code:string}}[]}}[]};
export function safeIdentity(user:UserRecord):AuthIdentity{return {id:user.id,name:user.name,email:user.email,active:user.active,roles:user.roles.map(({role})=>({code:role.code,name:role.name})),permissions:[...new Set(user.roles.flatMap(({role})=>role.permissions.map(({permission})=>permission.code)))].sort()};}
