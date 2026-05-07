import fs from 'fs';

let content = fs.readFileSync('client/src/mobile/pages/MobilePatientFile.tsx', 'utf8');

content = content.replace(/v\.diagnoses/g, 'v.dentalFindings');
content = content.replace(/visit\.diagnoses/g, 'visit.dentalFindings');
content = content.replace(/v\.procedures/g, 'v.dentalProcedures');
content = content.replace(/visit\.procedures/g, 'visit.dentalProcedures');
content = content.replace(/allDiagnoses/g, 'allFindings');
content = content.replace(/key: "diagnostics", label: "🏥 Dx"/g, 'key: "diagnostics", label: "🦷 Findings"');
content = content.replace(/No diagnostics recorded/g, 'No findings recorded');
content = content.replace(/DermClinic/g, 'DentalClinic');

fs.writeFileSync('client/src/mobile/pages/MobilePatientFile.tsx', content);
console.log('Refactoring MobilePatientFile.tsx complete.');
