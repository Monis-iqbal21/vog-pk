const field=(label,...keys)=>({label,keys});
const group=(title,...fields)=>({title,fields});
export const productSpecificationGroups={
 'graphics-cards':[
  group('Graphics & memory',field('GPU','Graphics processor','chipset'),field('VRAM','Discrete graphics card memory','vram'),field('Memory type','Graphics card memory type','memoryType'),field('Memory interface','Memory bus','memoryBus'),field('Boost clock','Processor boost clock speed','boostClock')),
  group('Cooling & connections',field('Interface','Interface type','interface'),field('Cooling','Cooling type','cooling'),field('Fans','Number of fans','fans'),field('HDMI outputs','HDMI ports quantity','hdmi'),field('DisplayPort outputs','DisplayPorts quantity','displayPort'),field('Recommended power','Minimum system power supply','powerRequirement'),field('GPU length','Depth','length')),
 ],
 processors:[group('Processor',field('Socket','Socket','socket'),field('Cores','Cores','cores'),field('Threads','Threads','threads'),field('Base clock','Base clock','baseClock'),field('Maximum boost','Maximum boost','boostClock'),field('Cache','Cache','cache'),field('Base power / TDP','Base power','TDP','tdp'),field('Integrated graphics','Integrated graphics','integratedGraphics'))],
 motherboards:[
  group('Platform & memory',field('Socket','Processor socket','socket'),field('Chipset','Motherboard chipset','chipset'),field('Form factor','Motherboard form factor','formFactor'),field('Memory support','Supported memory types','memorySupport'),field('Memory slot type','Memory slots type'),field('Memory slots','Number of memory slots')),
  group('Expansion & networking',field('PCIe slots','PCI Express x16 slots','pcieSlots'),field('M.2 slots','Number of M.2 (M) slots','m2Slots'),field('Wi-Fi','Top Wi-Fi standard','wifi'),field('Ethernet','Ethernet interface type','ethernet')),
 ],
 ram:[group('Memory',field('Capacity','Internal memory','capacity'),field('Generation','Internal memory type','generation'),field('Rated speed','Memory data transfer rate','Memory clock speed','speed'),field('CAS latency','CAS latency','latency'),field('Kit configuration','Memory layout (modules x size)','kit'),field('Form factor','Memory form factor','formFactor'),field('Voltage','Memory voltage','voltage'),field('Colour','Product colour','color'))],
 keyboards:[
  group('Keys & switches',field('Form factor','Keyboard form factor','formFactor'),field('Layout','Keyboard layout','layout'),field('Language','Keyboard language','language'),field('Switch technology','Keyboard key switch','switchTechnology'),field('Switch model','Keyboard key switch technology','switchModel'),field('Keys','Keyboard number of keys','keyCount'),field('Keycaps','Keycap material','keycapMaterial'),field('Rapid Trigger','Rapid Trigger','rapidTrigger')),
  group('Connectivity & design',field('Connectivity','Device interface','connectivity'),field('Polling rate','Polling rate','pollingRate'),field('Lighting','Backlight type','rgb'),field('Colour','Product colour','color')),
 ],
 'gaming-mice':[
  group('Tracking & controls',field('Sensor technology','Movement detection technology','sensorTechnology'),field('Sensor model','Sensor','sensor'),field('Resolution','Movement resolution','dpi'),field('Polling rate','Polling rate','pollingRate'),field('Buttons','Buttons quantity','buttons'),field('Switch technology','Switch technology','switchTechnology')),
  group('Connectivity & design',field('Connectivity','Device interface','connectivity'),field('Weight','Weight','weight'),field('Shape','Form factor','shape'),field('Battery','Battery','battery'),field('Colour','Product colour','color')),
 ],
 monitors:[
  group('Display',field('Screen size','Display diagonal','screenSize'),field('Resolution','Display resolution','resolution'),field('Panel','Panel type','panelType'),field('Display technology','Display technology','displayTechnology'),field('Maximum refresh rate','Maximum refresh rate','refreshRate'),field('Response time','Response time','responseTime'),field('Screen shape','Screen shape','screenShape'),field('Display surface','Display surface','surface')),
  group('Connectivity & design',field('Inputs','Connectivity','connectivity'),field('HDMI','HDMI ports quantity','hdmi'),field('DisplayPort','DisplayPorts quantity','displayPort'),field('Colour','Product colour','color')),
 ],
 storage:[group('Storage & performance',field('Capacity','SSD capacity','capacity'),field('Form factor','SSD form factor','formFactor'),field('Interface','Interface','interface'),field('NVMe','NVMe','nvme'),field('Sequential read','Read speed','readSpeed'),field('Sequential write','Write speed','writeSpeed'),field('Memory type','Memory type','memoryType'),field('Endurance','TBW rating','endurance'))],
 'power-supplies':[group('Power & efficiency',field('Rated power','Total power','power'),field('Efficiency certification','80 PLUS certification','efficiency'),field('Cabling','Cabling type','cabling'),field('Form factor','Power supply unit (PSU) form factor','formFactor'),field('Fan diameter','Fan diameter','fanDiameter'),field('ATX standard','ATX version','atxVersion'),field('Colour','Product colour','color'))],
 'pc-cases':[
  group('Chassis & compatibility',field('Case form factor','Form factor','formFactor'),field('Motherboard support','Supported motherboard form factors','motherboardSupport'),field('GPU clearance','Maximum graphics card length','gpuClearance'),field('CPU cooler clearance','Maximum CPU cooler height','coolerClearance'),field('Front fan support','Number of front fans supported (max)','frontFans'),field('Radiator support','Radiator support','radiatorSupport')),
  group('Dimensions & finish',field('Width','Width','width'),field('Height','Height','height'),field('Depth','Depth','depth'),field('Colour','Product colour','color')),
 ],
 cooling:[group('Cooling & compatibility',field('Cooling type','Type','type'),field('Radiator length','Radiator width','radiatorLength'),field('Radiator width','Radiator depth','radiatorWidth'),field('Fans','Number of fans','fanCount'),field('Fan diameter','Fan diameter','fanDiameter'),field('Supported sockets','Supported processor sockets','supportedSockets'),field('Colour','Product colour','color'))],
 accessories:[group('Design & dimensions',field('Product type','Product type','type'),field('Width','Width','width'),field('Depth','Depth','depth'),field('Thickness','Thickness','thickness'),field('Material','Material','material'),field('Surface','Surface coloration','surface'),field('Colour','Product colour','color'))],
};
