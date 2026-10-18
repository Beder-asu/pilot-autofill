const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const sourceDirectories = [
  'background',
  'content',
  'popup',
  'settings',
  'storage',
  'tests',
];

function collectJavaScript(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? collectJavaScript(path)
      : path.endsWith('.js')
        ? [path]
        : [];
  });
}

const files = sourceDirectories.flatMap((directory) =>
  collectJavaScript(join(root, directory)),
);

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) {
  throw new Error('manifest.json must use Manifest V3');
}

const referencedFiles = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_ui?.page,
  ...(manifest.content_scripts || []).flatMap((entry) => entry.js || []),
].filter(Boolean);

for (const referencedFile of referencedFiles) {
  const path = join(root, referencedFile);
  if (!statSync(path).isFile()) {
    throw new Error(`Manifest references a missing file: ${referencedFile}`);
  }
}

console.log(`Validated ${files.length} JavaScript files and ${referencedFiles.length} manifest references.`);
