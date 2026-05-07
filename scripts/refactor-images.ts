import fs from 'fs';

let content = fs.readFileSync('server/modules/images/index.ts', 'utf8');
content = content.replace(/patientImages/g, 'dentalMedia');
fs.writeFileSync('server/modules/images/index.ts', content);
console.log('Refactoring images module complete.');
