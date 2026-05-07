import fs from 'fs';

const files = [
    'client/src/pages/Reports.tsx',
    'client/src/pages/Dashboard.tsx',
    'client/index.html'
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(/DermClinic/g, 'DentalClinic');
        fs.writeFileSync(file, content);
    }
}
console.log('Refactoring misc complete.');
