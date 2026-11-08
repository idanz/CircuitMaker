import type { BlueprintJSON } from './circuit';
export interface Entity { readonly name: string; toEntity(number: number): BlueprintJSON; }
export type Edge = [Entity, Entity, 'red' | 'green', 'input' | 'output', 'input' | 'output'];
export const session = { active: false, entities: [] as Entity[], wires: [] as Edge[], simulations: [] as {toPlan(): unknown}[] };
export function record(entity: Entity) { if (session.active) session.entities.push(entity); }
export function start() { session.entities = []; session.wires = []; session.simulations=[]; session.active = true; }
export function finish() { session.active = false; session.entities = []; session.wires = []; session.simulations=[]; }
