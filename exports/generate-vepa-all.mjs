import { execFileSync } from 'node:child_process';

console.log('==================================================');
console.log('Starting VEPA full documentation & codebase bundle');
console.log('==================================================\n');

try {
    // 1. Run Comprehensive Documentation Concatenation (Script 2)
    console.log('[1/2] Generating documentation summary...');
    execFileSync(process.execPath, ['exports/generate-docs-concat.mjs'], { stdio: 'inherit' });
    console.log('--> Documentation summary generated successfully.\n');

    // 2. Run Full Hierarchical Codebase Concatenation on the vepa directory (Script 3)
    const snapshotDir = '.';
    const outFile = 'exports/vepa-full-codebase-concat.md';
    const genFullPath = 'exports/generate-full-concat.mjs';

    console.log(`[2/2] Generating full hierarchical codebase bundle for "${snapshotDir}"...`);
    execFileSync(process.execPath, [genFullPath, snapshotDir, outFile], { stdio: 'inherit' });
    console.log(`--> Full codebase bundle generated successfully at "${outFile}".\n`);

    console.log('==================================================');
    console.log('All VEPA concatenation tasks completed successfully!');
    console.log('==================================================');

} catch (error) {
    console.error('An error occurred during the concatenation process:', error.message || error);
    process.exit(1);
}
