// Reviewed supplements only. The 7A source snapshot and raw values are immutable.
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildManifest,
  canonical,
  digest,
  root,
} from './legacy-catalog-manifest.mjs';
import { convertNumber, UNITS } from '../dist/product-types/registry.js';

export async function buildPreflightManifest() {
  const baseline = await buildManifest(),
    manifest = structuredClone(baseline);
  const retained = JSON.parse(
    await fs.readFile(
      path.join(root, 'frontend/docs/catalogue-retained-research.json'),
      'utf8',
    ),
  );
  const candidates = JSON.parse(
    await fs.readFile(
      path.join(root, 'frontend/docs/catalogue-candidate-research.json'),
      'utf8',
    ),
  ).candidates;
  const original = JSON.parse(
    await fs.readFile(
      path.join(root, 'backend/docs/catalog-migration/manifest.json'),
      'utf8',
    ),
  );
  const gallerySources = JSON.parse(
    await fs.readFile(
      path.join(root, 'frontend/docs/product-detail-gallery-sources.json'),
      'utf8',
    ),
  );
  if (baseline.checksum !== original.checksum)
    throw Error('7A baseline drift; reconcile before preflight.');
  const resolutions = [];
  for (const finding of baseline.exceptions) {
    const record = manifest.records.find(
      (r) => r.sourceKey === finding.product,
    );
    let resolution;
    if (finding.reason.startsWith('NO_LOSSLESS')) {
      const spec = record.specs.find((s) => s.label === finding.field),
        match =
          typeof spec.raw === 'string' &&
          spec.raw.match(/^(\d+(?:\.\d{1,6})?) (cm|TB)$/);
      // Only the audited source pairs occur in the 43 unit-only findings.
      const target =
        match?.[2] === 'cm' ? 'mm' : match?.[2] === 'TB' ? 'GB' : null;
      if (target) {
        const value = convertNumber(match[1], match[2], target);
        if (convertNumber(value, target, match[2]) !== match[1])
          throw Error('Unit conversion is not lossless.');
        spec.numeric = {
          number: value,
          unit: target,
          provenance: {
            raw: spec.raw,
            sourceUnit: match[2],
            canonicalUnit: target,
            method: 'existing shared exact-decimal unit registry',
          },
        };
        resolution = {
          kind: 'EXACT_UNIT_CONVERSION',
          raw: spec.raw,
          result: spec.numeric,
        };
      }
    } else if (finding.reason.startsWith('SOURCE_FILTER')) {
      const product = record.source.product;
      const reference = [...retained, ...candidates].find(
        (r) =>
          r.id === product.id &&
          r.status === 200 &&
          r.apiUrl === product.specificationSourceUrl &&
          r.returnedCode === product.manufacturerSku,
      );
      // Finite explicit mappings; never infer from names, photos or another SKU.
      const key = {
        gpu_manufacturer: 'Graphics processor family',
        polling_rate: 'Polling rate',
        size: 'Size',
      }[finding.field];
      const value = reference?.specs?.[key];
      const valid =
        key === 'Graphics processor family'
          ? value === 'NVIDIA'
          : key === 'Polling rate'
            ? typeof value === 'string' && /^\d+ Hz$/.test(value)
            : key === 'Size'
              ? ['L', 'XXL'].includes(value)
              : false;
      if (valid) {
        const facet = record.filters.find((f) => f.code === finding.field);
        facet.values = [value];
        facet.provenance = {
          file: retained.includes(reference)
            ? 'frontend/docs/catalogue-retained-research.json'
            : 'frontend/docs/catalogue-candidate-research.json',
          id: reference.id,
          apiUrl: reference.apiUrl,
          returnedCode: reference.returnedCode,
          field: key,
          originalValue: value,
          verification:
            'Cached existing exact-SKU source; not a fresh remote fact check',
        };
        resolution = {
          kind: 'EXACT_CACHED_SKU_FIELD',
          result: value,
          provenance: facet.provenance,
        };
      }
    }
    if (resolution) resolutions.push({ ...finding, resolution });
  }
  const closed = new Set(
    resolutions.map((r) => canonical([r.product, r.field, r.reason])),
  );
  manifest.exceptions = baseline.exceptions.filter(
    (r) => !closed.has(canonical([r.product, r.field, r.reason])),
  );
  manifest.reviewProfile = '7B-reviewed-existing-sources';
  manifest.baselineChecksum = baseline.checksum;
  manifest.reviewSources = {};
  for (const file of [
    'frontend/docs/catalogue-retained-research.json',
    'frontend/docs/catalogue-candidate-research.json',
  ])
    manifest.reviewSources[file] = digest(
      (await fs.readFile(path.join(root, file), 'utf8')).replaceAll(
        '\r\n',
        '\n',
      ),
    );
  manifest.resolutions = resolutions;
  manifest.mediaProvenanceCorrections = [];
  for (const r of manifest.records)
    for (const media of r.media) {
      const gallery = gallerySources.find(
        (g) => g.productId === r.sourceKey && g.src === media.src,
      );
      if (gallery) {
        manifest.mediaProvenanceCorrections.push({
          product: r.sourceKey,
          path: media.src,
          previousSourceUrl: media.sourceUrl,
          sourceUrl: gallery.downloadUrl,
          evidence: 'frontend/docs/product-detail-gallery-sources.json',
          reason:
            'Additional gallery view has its own download/source record; do not inherit the primary photograph URL',
        });
        media.sourceUrl = gallery.downloadUrl;
        media.provenance = {
          record: gallery.id,
          sourceUrl: gallery.sourceUrl,
          license: gallery.license,
          licenseUrl: gallery.licenseUrl,
          developmentOnly: gallery.developmentOnly,
          modifications: gallery.modifications,
        };
      }
    }
  manifest.reviewSources['frontend/docs/product-detail-gallery-sources.json'] =
    digest(
      (
        await fs.readFile(
          path.join(root, 'frontend/docs/product-detail-gallery-sources.json'),
          'utf8',
        )
      ).replaceAll('\r\n', '\n'),
    );
  const { checksum, ...body } = manifest;
  manifest.checksum = digest(body);
  if (
    resolutions.filter((r) => r.resolution.kind === 'EXACT_UNIT_CONVERSION')
      .length !== 43
  )
    throw Error('Reviewed conversion coverage changed.');
  if (!UNITS.some((u) => u.code === 'GB'))
    throw Error('Required registered unit absent.');
  return manifest;
}
