const types = { 'decider-combinator': 'Decider', 'arithmetic-combinator': 'Arithmetic', 'constant-combinator': 'Constant', 'circuitmaker-driver': 'Driver' };
export function networkNames(networks) {
  return ['red', 'green'].filter(color => networks?.[color] ?? true);
}
function operand(signal, value, networks) {
  return signal ? { signal, networks: networkNames(networks) } : { value: value ?? 0 };
}
export function describeEntity(entity, label) {
  const behavior = entity.control_behavior ?? {};
  const result = { id: entity.entity_number, label: label || `${types[entity.name] ?? entity.name} ${entity.entity_number}`, type: types[entity.name] ?? entity.name, entity };
  if(entity.driver)result.driver=entity.driver;
  if (behavior.decider_conditions) {
    const decider = behavior.decider_conditions;
    result.groups = [];
    for (const condition of decider.conditions ?? []) {
      if (!result.groups.length || condition.compare_type === 'or') result.groups.push([]);
      result.groups.at(-1).push({ left: operand(condition.first_signal, 0, condition.first_signal_networks), comparator: condition.comparator ?? '<', right: operand(condition.second_signal, condition.constant, condition.second_signal_networks) });
    }
    result.outputs = (decider.outputs ?? []).map(output => ({ ...operand(output.signal, 0, output.networks), copy: output.copy_count_from_input ?? true, count: output.constant ?? 1, otherwise: !!output.is_else }));
  } else if (behavior.arithmetic_conditions) {
    const math = behavior.arithmetic_conditions;
    result.arithmetic = { left: operand(math.first_signal, math.first_constant, math.first_signal_networks), operation: math.operation, right: operand(math.second_signal, math.second_constant, math.second_signal_networks), output: math.output_signal };
  } else if (entity.name === 'constant-combinator') {
    result.enabled = behavior.is_on !== false;
    result.sections = (behavior.sections?.sections ?? []).map(section => ({ name: section.group || `Section ${section.index}`, group: section.group ?? null, index: section.index, enabled: section.active !== false, slots: section.filters ?? [] }));
  }
  return result;
}
export function describeCircuit(data) {
  const blueprint = data?.blueprint ?? {};
  const labels = new Map();
  for (const line of (blueprint.description ?? '').split('\n')) {
    const match = /^(\d+): (.*)$/.exec(line);
    if (match) labels.set(Number(match[1]), match[2]);
  }
  const entities = (blueprint.entities ?? []).map(entity => describeEntity(entity, labels.get(entity.entity_number)));
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  const endpoint = (id, connector) => ({ id, port: ['Constant','Driver'].includes(byId.get(id)?.type) || connector >= 3 ? 'output' : 'input', color: connector % 2 === 0 ? 'green' : 'red' });
  const wires = (blueprint.wires ?? []).filter(([a,,b]) => byId.has(a) && byId.has(b)).map(([a,ap,b,bp]) => ({ from: endpoint(a,ap), to: endpoint(b,bp), color: ap % 2 === 0 ? 'green' : 'red' }));
  return { label: blueprint.label ?? 'Circuit', entities, wires };
}
