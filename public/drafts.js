export function resetDrafts(inputs, missionId = null, notes = null) {
  for (const key of Object.keys(inputs)) delete inputs[key];
  if (missionId && notes?.missionId === missionId) inputs.notes = notes.text;
}
