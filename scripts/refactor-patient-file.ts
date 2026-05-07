import fs from 'fs';

let content = fs.readFileSync('client/src/pages/PatientFile.tsx', 'utf8');

// Visit history display
content = content.replace(/visit\.diagnoses/g, 'visit.dentalFindings');
content = content.replace(/visit\.procedures/g, 'visit.dentalProcedures');

// Form states
content = content.replace(/selectedDiagnoses/g, 'selectedFindings');
content = content.replace(/addedDiagnoses/g, 'addedFindings');
content = content.replace(/setSelectedDiagnoses/g, 'setSelectedFindings');
content = content.replace(/setAddedDiagnoses/g, 'setAddedFindings');
content = content.replace(/editingDiagId/g, 'editingFindingId');
content = content.replace(/setEditingDiagId/g, 'setEditingFindingId');
content = content.replace(/editingDiagValue/g, 'editingFindingValue');
content = content.replace(/setEditingDiagValue/g, 'setEditingFindingValue');

// API calls
content = content.replace(/api\.visits\.addDiagnosis/g, 'api.visits.addFinding');
content = content.replace(/api\.visits\.updateDiagnosis/g, 'api.visits.updateFinding');
content = content.replace(/api\.visits\.deleteDiagnosis/g, 'api.visits.deleteFinding');

// Mutations
content = content.replace(/addDiagnosisMutation/g, 'addFindingMutation');
content = content.replace(/updateDiagnosisMutation/g, 'updateFindingMutation');
content = content.replace(/deleteDiag/g, 'deleteFinding');

// Autocomplete category
content = content.replace(/category="diagnosis"/g, 'category="dental_finding"');
content = content.replace(/Select diagnosis.../g, 'Select finding...');
content = content.replace(/🏥 Diagnostic/g, '🦷 Finding');

// Procedure API is mostly the same but ensure the array mapping works
content = content.replace(/visit\.procedures\.map/g, 'visit.dentalProcedures.map');

// Print payloads
content = content.replace(/diagnoses: addedFindings/g, 'diagnoses: addedFindings'); // if already replaced
content = content.replace(/diagnoses: addedDiagnoses/g, 'diagnoses: addedFindings');

fs.writeFileSync('client/src/pages/PatientFile.tsx', content);
console.log('Refactoring PatientFile.tsx complete.');
