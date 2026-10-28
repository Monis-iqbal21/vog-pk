// Exact structured-field adapters only. No product-name/description inference.
const facet=(code,label,keys,split=false)=>({code,label,keys,split});
const colour=facet('color','Colour',['Product colour','color'],true);
const connectivity=facet('connectivity','Connectivity',['Device interface','Connectivity','connectivity']);
export const categoryFilters={
 'graphics-cards':[
  facet('gpu-manufacturer','GPU manufacturer',['Graphics processor manufacturer','gpuManufacturer']),facet('gpu','GPU model',['Graphics processor','gpu']),
  facet('vram','VRAM capacity',['Discrete graphics card memory','vram']),facet('memory-type','Memory type',['Graphics card memory type','memoryType']),
 ],
 processors:[facet('manufacturer','Manufacturer',['Manufacturer','manufacturer']),facet('socket','Socket',['Socket','socket']),facet('cores','Core count',['Cores','cores']),facet('family','Processor family',['Processor family','family'])],
 motherboards:[facet('socket','Socket',['Processor socket','socket']),facet('chipset','Chipset',['Motherboard chipset','chipset']),facet('form-factor','Form factor',['Motherboard form factor','formFactor']),facet('memory-support','Memory support',['Supported memory types','memorySupport'],true)],
 ram:[facet('capacity','Capacity',['Internal memory','capacity']),facet('generation','DDR generation',['Internal memory type','generation']),facet('frequency','Rated frequency / data rate',['Memory data transfer rate','Memory clock speed','speed']),facet('kit','Kit configuration',['Memory layout (modules x size)','kit']),colour],
 storage:[facet('storage-type','Storage type',['Storage type','storageType']),facet('capacity','Capacity',['SSD capacity','capacity']),facet('interface','Interface',['Interface','interface']),facet('form-factor','Form factor',['SSD form factor','formFactor'])],
 keyboards:[facet('switch-technology','Switch technology',['Keyboard key switch','switchType']),facet('switch-model','Switch model',['Keyboard key switch technology','switchModel']),facet('layout','Keyboard size / layout',['Keyboard form factor','layout']),connectivity,colour],
 'gaming-mice':[connectivity,facet('sensor','Sensor technology',['Movement detection technology','sensor']),facet('dpi','DPI',['Movement resolution','dpi']),facet('polling-rate','Polling rate',['Polling rate','pollingRate']),facet('weight','Weight',['Weight','weight']),colour],
 monitors:[facet('screen-size','Screen size',['Display diagonal','screenSize']),facet('resolution','Resolution',['Display resolution','resolution']),facet('refresh-rate','Refresh rate',['Maximum refresh rate','refreshRate']),facet('panel','Panel type',['Panel type','panelType'])],
 'power-supplies':[facet('wattage','Wattage',['Total power','wattage']),facet('efficiency','Efficiency certification',['80 PLUS certification','efficiency']),facet('modularity','Modularity',['Cabling type','modularity'])],
 'pc-cases':[facet('motherboard-support','Motherboard support',['Supported motherboard form factors','motherboardSupport'],true),colour,facet('case-type','Case type',['Form factor','caseType']),facet('gpu-clearance','Maximum GPU clearance',['Maximum graphics card length','gpuClearance'])],
 cooling:[facet('cooler-type','Cooling type',['Type','type']),facet('radiator-size','Radiator size',['Radiator size','radiatorSize']),facet('socket','Socket compatibility',['Supported processor sockets','supportedSockets'],true),colour],
 accessories:[facet('accessory-type','Accessory type',['Product type','type']),connectivity,facet('compatibility','Compatibility',['Compatibility','compatibility'],true),facet('size','Size',['Size','size']),facet('width','Width',['Width','width']),facet('depth','Depth',['Depth','depth']),colour],
};
export const categoryDescriptions={
 'graphics-cards':'Compare graphics cards by GPU, memory and retailer reference price.',processors:'Explore processors by socket, core count and retailer reference price.',motherboards:'Find motherboards by chipset, socket and form factor.',ram:'Compare memory capacity, DDR generation and rated speed.',storage:'Explore storage by capacity, interface and form factor.',keyboards:'Compare keyboard sizes, switches and connectivity.',
 'gaming-mice':'Explore gaming mice by connectivity, sensor technology and weight.',monitors:'Compare monitors by screen size, resolution and refresh rate.','power-supplies':'Find power supplies by wattage, efficiency and modularity.','pc-cases':'Explore cases by motherboard support, size and GPU clearance.',cooling:'Compare cooling options and recorded socket compatibility.',accessories:'Explore accessories using the dimensions and attributes currently recorded.',
};
