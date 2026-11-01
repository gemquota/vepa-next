import fs from 'node:fs';
import path from 'node:path';

// Define the list of documentation/specification files to concatenate
const docFiles = [
    'README.md',
    'src/physics/lawgroups/SPEC.md',
    // Add any other documentation paths here
];

const outputFile = 'exports/vepa-docs-concat.md';

console.log('Generating documentation summary...');

let combinedContent = `# VEPA4 Documentation Summary\n\nGenerated on: ${new Date().toISOString()}\n\n`;

let foundCount = 0;
for (const file of docFiles) {
    if (fs.existsSync(file)) {
        console.log(`Including: ${file}`);
        const content = fs.readFileSync(file, 'utf8');
        combinedContent += `\n\n---\n\n## File: ${file}\n\n${content}`;
        foundCount++;
    } else {
        console.warn(`Skipping missing documentation file: ${file}`);
    }
}

// Ensure exports directory exists
const outDir = path.dirname(outputFile);
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outputFile, combinedContent, 'utf8');
console.log(`Documentation bundle successfully written to ${outputFile} (${foundCount} files included).`);
