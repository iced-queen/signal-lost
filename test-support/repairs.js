export function repairSteps(module) {
  if (module.type === 'wires') return [
    { stage: 'isolate', value: module.answer },
    { stage: 'patch', value: module.secondaryAnswer },
  ];
  if (module.type === 'glyphs') return [
    ...module.answer.map((glyph) => ({ stage: 'sequence', value: glyph })),
    { stage: 'align', value: module.secondaryAnswer },
  ];
  if (module.type === 'pulses') return [
    { stage: 'decode', value: module.answer },
    { stage: 'sync', value: module.secondaryAnswer },
  ];
  return [{ stage: 'tune', value: { frequency: module.answer, bandwidth: module.secondaryAnswer } }];
}
