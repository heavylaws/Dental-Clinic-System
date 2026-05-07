import fs from 'fs';

const files = [
    'client/src/components/PrescriptionPrint.tsx',
    'client/src/components/LabPrint.tsx',
    'client/src/components/ClinicalNotesPrint.tsx'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/DermClinic/g, 'DentalClinic');
    content = content.replace(/<span className="text-2xl">🩺<\/span>/g, '<span className="text-2xl">🦷</span>');
    fs.writeFileSync(file, content);
}
console.log('Refactoring prints complete.');
