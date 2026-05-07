import fs from 'fs';

let content = fs.readFileSync('client/src/mobile/pages/MobileVisitForm.tsx', 'utf8');

// Replace state and functions
content = content.replace(/addedDiagnoses/g, 'addedFindings');
content = content.replace(/setAddedDiagnoses/g, 'setAddedFindings');
content = content.replace(/diagInput/g, 'findingInput');
content = content.replace(/setDiagInput/g, 'setFindingInput');
content = content.replace(/diagSuggestions/g, 'findingSuggestions');
content = content.replace(/addDiag/g, 'addFinding');
content = content.replace(/deleteDiag/g, 'deleteFinding');

// API calls
content = content.replace(/api\.visits\.addDiagnosis/g, 'api.visits.addFinding');
content = content.replace(/api\.visits\.deleteDiagnosis/g, 'api.visits.deleteFinding');

// Autocomplete
content = content.replace(/"diagnosis"/g, '"dental_finding"');

// UI Text
content = content.replace(/"Diagnosis"/g, '"Findings"');
content = content.replace(/>Diagnoses</g, '>Findings<');
content = content.replace(/Step 2: Diagnoses/g, 'Step 2: Findings');
content = content.replace(/Search diagnosis\.\.\./g, 'Search finding...');
content = content.replace(/visit\.diagnoses/g, 'visit.dentalFindings');
content = content.replace(/visit\.procedures/g, 'visit.dentalProcedures');

// Also fix existingVisit population
content = content.replace(/existingVisit\.diagnoses/g, 'existingVisit.dentalFindings');
content = content.replace(/existingVisit\.procedures/g, 'existingVisit.dentalProcedures');

fs.writeFileSync('client/src/mobile/pages/MobileVisitForm.tsx', content);
console.log('Refactoring MobileVisitForm.tsx complete.');
