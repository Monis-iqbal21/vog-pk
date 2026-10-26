// Only exact-model photographs with documented reuse permission belong here.
// Credits, modifications, source dimensions and remaining gaps: docs/product-image-assets.md.
const commons = 'https://commons.wikimedia.org/wiki/File:';

export const productImages = {
  'intel-core-i9-14900k': {
    sourceFile: 'Intel_i9-14900K.webp',
    sourceUrl: `${commons}Intel_i9-14900K.webp`,
    author: 'ArtyomK2707',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    alt: 'Intel Core i9-14900K processor with its model marking visible',
    verification: 'Own-work photograph; i9-14900K marking visually confirmed.',
  },
  'amd-ryzen9-9950x3d': {
    sourceFile: 'AMD_RYZEN_9_9950X3D_-_DOVRESTI_COMPRARLO¿_(1920p_30fps_VP9_LQ-128kbit_AAC)-00.00.18.500.png',
    sourceUrl: `${commons}AMD_RYZEN_9_9950X3D_-_DOVRESTI_COMPRARLO%C2%BF_(1920p_30fps_VP9_LQ-128kbit_AAC)-00.00.18.500.png`,
    author: 'MoreThanTech',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    alt: 'AMD Ryzen 9 9950X3D processor photographed among flowers, with its model marking visible',
    verification: '9950X3D marking visually confirmed; Commons source-license review recorded 2026-06-07.',
  },
  'amd-ryzen7-9800x3d': {
    sourceFile: 'Video_zum_AMD_Ryzen_7_9800X3D_(ZMASLO)_29.png',
    sourceUrl: `${commons}Video_zum_AMD_Ryzen_7_9800X3D_(ZMASLO)_29.png`,
    author: 'ZMASLO',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    alt: 'AMD Ryzen 7 9800X3D processor installed in an AM5 socket, with its model marking visible',
    verification: '9800X3D marking visually confirmed; installed CPU photograph, not an image of the motherboard being sold.',
  },
  'intel-core-ultra9-285k': {
    sourceFile: 'INTEL_CORE_ULTRA_7_265K_-_DOVRESTI_COMPRARLO¿_👀_(1920p_25fps_VP9_LQ-128kbit_AAC)-00.01.41.200.png',
    sourceUrl: `${commons}INTEL_CORE_ULTRA_7_265K_-_DOVRESTI_COMPRARLO%C2%BF_%F0%9F%91%80_(1920p_25fps_VP9_LQ-128kbit_AAC)-00.01.41.200.png`,
    author: 'MoreThanTech',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    alt: 'Intel Core Ultra 9 285K processor standing in a holder, with its 285K model marking visible',
    verification: '285K marking visually confirmed despite the source video title mentioning 265K; file category identifies 285K. Commons source-license review recorded 2026-06-07.',
  },
};
