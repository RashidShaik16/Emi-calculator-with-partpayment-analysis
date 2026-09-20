#!/usr/bin/env node
/**
 * sync-includes.js
 * KnowYourEMI shared-component synchronizer.
 *
 * Shared regions:
 *   NAV    -> nav/nav.html
 *   FOOTER -> footer/footer.html
 *
 * Run from the project root:
 *   node scripts/sync-includes.js
 *
 * The NAV partial is intended to contain both desktop and mobile
 * navigation markup, plus any navigation-specific behavior.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const REGIONS = [
  {
    name: 'NAV',
    partialPath: path.join(ROOT_DIR, 'nav', 'nav.html'),
    startMarker: '<!-- NAV:START -->',
    endMarker: '<!-- NAV:END -->',
  },
  {
    name: 'FOOTER',
    partialPath: path.join(ROOT_DIR, 'footer', 'footer.html'),
    startMarker: '<!-- FOOTER:START -->',
    endMarker: '<!-- FOOTER:END -->',
  },
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'nav',
  'footer',
  'scripts',
  'dist',
  'build',
]);

function findHtmlFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      findHtmlFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      results.push(fullPath);
    }
  }

  return results;
}

function countOccurrences(content, marker) {
  let count = 0;
  let offset = 0;

  while (true) {
    const index = content.indexOf(marker, offset);
    if (index === -1) break;
    count++;
    offset = index + marker.length;
  }

  return count;
}

function syncRegionIntoContent(content, region, partialContent) {
  const startCount = countOccurrences(content, region.startMarker);
  const endCount = countOccurrences(content, region.endMarker);

  if (startCount === 0 && endCount === 0) {
    return { content, changed: false, found: false };
  }

  if (startCount !== 1 || endCount !== 1) {
    return {
      content,
      changed: false,
      found: true,
      error: `expected exactly one START and END marker, found ${startCount} START and ${endCount} END`,
    };
  }

  const startIdx = content.indexOf(region.startMarker);
  const endIdx = content.indexOf(region.endMarker);

  if (endIdx < startIdx) {
    return {
      content,
      changed: false,
      found: true,
      error: 'markers-out-of-order',
    };
  }

  const before = content.slice(0, startIdx + region.startMarker.length);
  const after = content.slice(endIdx);
  const updated = `${before}\n\n${partialContent.trim()}\n\n${after}`;

  return { content: updated, changed: updated !== content, found: true };
}

function main() {
  const loadedPartials = {};

  for (const region of REGIONS) {
    if (!fs.existsSync(region.partialPath)) {
      console.error(`\nERROR: Partial not found for ${region.name}`);
      console.error(`Expected: ${region.partialPath}\n`);
      process.exit(1);
    }

    loadedPartials[region.name] = fs.readFileSync(region.partialPath, 'utf8');
  }

  const htmlFiles = findHtmlFiles(ROOT_DIR);
  let updatedFiles = 0;
  let untouchedFiles = 0;
  let skippedFiles = 0;
  let errorFiles = 0;
  const regionUpdateCounts = {};
  REGIONS.forEach((region) => { regionUpdateCounts[region.name] = 0; });

  console.log('\nKnowYourEMI shared component sync');
  console.log(`Root: ${ROOT_DIR}`);
  console.log(`HTML files found: ${htmlFiles.length}\n`);

  for (const filePath of htmlFiles) {
    const relPath = path.relative(ROOT_DIR, filePath);
    let content = fs.readFileSync(filePath, 'utf8');
    let fileChanged = false;
    const foundRegions = [];
    const errors = [];

    for (const region of REGIONS) {
      const result = syncRegionIntoContent(content, region, loadedPartials[region.name]);

      if (result.found) {
        foundRegions.push(region.name);
        if (result.error) {
          errors.push(`${region.name}: ${result.error}`);
          continue;
        }
        if (result.changed) {
          content = result.content;
          fileChanged = true;
          regionUpdateCounts[region.name]++;
        }
      }
    }

    if (errors.length > 0) {
      console.error(`  ERROR    ${relPath}`);
      errors.forEach((error) => console.error(`           ${error}`));
      errorFiles++;
      continue;
    }

    if (fileChanged) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  updated  ${relPath}  [${foundRegions.join(', ')}]`);
      updatedFiles++;
    } else if (foundRegions.length > 0) {
      console.log(`  ok       ${relPath}  [${foundRegions.join(', ')}]`);
      untouchedFiles++;
    } else {
      console.log(`  skipped  ${relPath}  [no shared markers]`);
      skippedFiles++;
    }
  }

  console.log('\nSync complete.');
  console.log(`  Files updated: ${updatedFiles}`);
  console.log(`  Files already up to date: ${untouchedFiles}`);
  console.log(`  Files skipped: ${skippedFiles}`);
  console.log(`  Files with marker errors: ${errorFiles}`);
  REGIONS.forEach((region) => {
    console.log(`  ${region.name} region updated in ${regionUpdateCounts[region.name]} file(s)`);
  });

  if (errorFiles > 0) process.exitCode = 1;
}

main();