import { execSync } from 'child_process';
import fs from 'node:fs';

console.log('==================================================');
console.log('Starting VEPA full documentation & codebase bundle');
console.log('==================================================\n');

try {
    // 1. Run Comprehensive Documentation Concatenation (Script 2)
    console.log('[1/2] Generating documentation summary...');
    execSync('node exports/generate-docs-concat.mjs', { stdio: 'inherit' });
    console.log('--> Documentation summary generated successfully.\n');

    // 2. Run Full Hierarchical Codebase Concatenation on the vepa directory (Script 3)
    const snapshotDir = '.';
    const outFile = 'exports/vepa-full-codebase-concat.md';
    const genFullPath = '.dist/gen-full.mjs';

    if (!fs.existsSync(genFullPath)) {
        throw new Error(`Could not find full generator script at "${genFullPath}". Please ensure gen-full.mjs is placed in the .dist/ directory.`);
    }

    console.log(`[2/2] Generating full hierarchical codebase bundle for "${snapshotDir}"...`);
    execSync(`node ${genFullPath} ${snapshotDir} ${outFile}`, { stdio: 'inherit' });
    console.log(`--> Full codebase bundle generated successfully at "${outFile}".\n`);

    console.log('==================================================');
    console.log('All VEPA concatenation tasks completed successfully!');
    console.log('==================================================');

} catch (error) {
    console.error('An error occurred during the concatenation process:', error.message || error);
    process.exit(1);
}
