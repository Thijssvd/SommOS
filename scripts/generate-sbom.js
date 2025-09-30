#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'build');
const outputFile = path.join(outputDir, 'sbom.json');

fs.mkdirSync(outputDir, { recursive: true });

const args = [
    'cyclonedx-npm',
    '--output-format',
    'JSON',
    '--output-file',
    outputFile
];

const result = spawnSync('npx', args, {
    cwd: projectRoot,
    stdio: 'inherit'
});

if (result.status !== 0) {
    console.error('❌ Failed to generate SBOM using cyclonedx-npm.');
    process.exit(result.status || 1);
}

console.log(`✅ SBOM generated at ${path.relative(projectRoot, outputFile)}`);
