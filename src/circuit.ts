import { zlibSync, strToU8 } from 'fflate';
import { record, session } from './graph-session';
import { serializeGraph } from './serialize-graph';
import { simulateScenario } from './simulation-engine';

/** A Factorio signal prototype type. */
export type SignalType = 'item' | 'fluid' | 'virtual' | 'entity' | 'recipe' | 'space-location' | 'asteroid-chunk' | 'quality';
export type Network = 'red' | 'green' | 'both';
export type Comparator = '>' | '<' | '=' | '≥' | '≤' | '≠';
export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
export type BlueprintJSON = { [key: string]: JSONValue };
export const MAX_CONDITIONS = 4096;
export const VERSION = 2 ** 49 + 36 * 2 ** 16;
const TYPES = new Set(['item', 'fluid', 'virtual', 'entity', 'recipe', 'space-location', 'asteroid-chunk', 'quality']);

function int32(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < -(2 ** 31) || value >= 2 ** 31) {
    throw new TypeError('Expected a signed 32-bit integer');
  }
}
function nonempty(value: unknown, message: string): asserts value is string {
  if (typeof value !== 'string' || !value) throw new TypeError(message);
}

/** Immutable signal. Wire selectors read the chosen INPUT network. */
export class Signal {
  constructor(public readonly name: string, public readonly type: SignalType = 'item', public readonly quality: string | null = null, public readonly network: Network = 'both') {
    nonempty(name, 'Signal name must be a nonempty string');
    if (!TYPES.has(type)) throw new TypeError('Unknown signal type');
    if (!['red', 'green', 'both'].includes(network)) throw new TypeError('Unknown input network');
    if (quality !== null) nonempty(quality, 'Quality must be a nonempty string');
    Object.freeze(this);
  }
  /** Read only the red input network. */
  get red(): Signal { return new Signal(this.name, this.type, this.quality, 'red'); }
  /** Read only the green input network. */
  get green(): Signal { return new Signal(this.name, this.type, this.quality, 'green'); }
  get both(): Signal { return new Signal(this.name, this.type, this.quality, 'both'); }
  withQuality(quality: string): Signal { return new Signal(this.name, this.type, quality, this.network); }
  toDict(): BlueprintJSON {
    return { type: this.type, name: this.name, ...(this.quality === null ? {} : { quality: this.quality }) };
  }
  private compare(comparator: Comparator, other: number | Signal): Expression {
    if (!(other instanceof Signal)) int32(other);
    return new Expression([[new Condition(this, comparator, other)]]);
  }
  greaterThan(other: number | Signal): Expression { return this.compare('>', other); }
  atLeast(other: number | Signal): Expression { return this.compare('≥', other); }
  lessThan(other: number | Signal): Expression { return this.compare('<', other); }
  atMost(other: number | Signal): Expression { return this.compare('≤', other); }
  /** Compare counts. JavaScript === compares objects, not circuit conditions. */
  equals(other: number | Signal): Expression { return this.compare('=', other); }
  notEquals(other: number | Signal): Expression { return this.compare('≠', other); }
  /** Emit a fixed count when the condition passes. */
  output(count = 1): Output { return new Output(this, count); }
  /** Copy this signal's count from the selected input networks. */
  copyInput(): Output { return new Output(this, null); }
}

export function item(name: string, quality: string | null = null): Signal { return new Signal(name, 'item', quality); }
export function fluid(name: string): Signal { return new Signal(name, 'fluid'); }
export function virtual(name: string): Signal { return new Signal(name.startsWith('signal-') ? name : `signal-${name}`, 'virtual'); }
export const EACH = virtual('each');
export const ANYTHING = virtual('anything');
export const EVERYTHING = virtual('everything');
function networks(signal: Signal): BlueprintJSON { return { red: signal.network !== 'green', green: signal.network !== 'red' }; }

class Condition {
  constructor(readonly left: Signal, readonly comparator: Comparator, readonly right: number | Signal) { Object.freeze(this); }
  toDict(): BlueprintJSON {
    return {
      first_signal: this.left.toDict(), comparator: this.comparator, first_signal_networks: networks(this.left),
      ...(this.right instanceof Signal ? { second_signal: this.right.toDict(), second_signal_networks: networks(this.right) } : { constant: this.right }),
    };
  }
}

/** OR groups of AND conditions. Use allOf/anyOf, or .and()/.or(). */
export class Expression {
  readonly groups: readonly (readonly Condition[])[];
  constructor(groups: readonly (readonly Condition[])[]) {
    if (!groups.length || groups.some(g => !g.length)) throw new TypeError('An expression needs at least one condition per group');
    if (groups.reduce((n, g) => n + g.length, 0) > MAX_CONDITIONS) throw new RangeError(`Expression expands beyond ${MAX_CONDITIONS} conditions`);
    this.groups = Object.freeze(groups.map(g => Object.freeze([...g])));
    Object.freeze(this);
  }
  and(other: Expression): Expression {
    if (!(other instanceof Expression)) throw new TypeError('AND requires an Expression');
    const size = this.groups.reduce((n, g) => n + g.length, 0) * other.groups.length + other.groups.reduce((n, g) => n + g.length, 0) * this.groups.length;
    if (size > MAX_CONDITIONS) throw new RangeError(`Expression expands beyond ${MAX_CONDITIONS} conditions`);
    return new Expression(this.groups.flatMap(a => other.groups.map(b => [...a, ...b])));
  }
  or(other: Expression): Expression {
    if (!(other instanceof Expression)) throw new TypeError('OR requires an Expression');
    return new Expression([...this.groups, ...other.groups]);
  }
  toConditions(): BlueprintJSON[] {
    const result: BlueprintJSON[] = [];
    for (const group of this.groups) group.forEach((c, i) => result.push({ ...c.toDict(), ...(result.length ? { compare_type: i ? 'and' : 'or' } : {}) }));
    return result;
  }
}
export function allOf(first: Expression, ...rest: Expression[]): Expression {
  if (!(first instanceof Expression)) throw new TypeError('allOf requires Expressions');
  return rest.reduce((a, b) => a.and(b), first);
}
export function anyOf(first: Expression, ...rest: Expression[]): Expression {
  if (!(first instanceof Expression)) throw new TypeError('anyOf requires Expressions');
  return rest.reduce((a, b) => a.or(b), first);
}

export class Output {
  constructor(readonly signal: Signal, readonly count: number | null = 1) {
    if (!(signal instanceof Signal)) throw new TypeError('Output requires a Signal');
    if (count !== null) int32(count);
    Object.freeze(this);
  }
  toDict(): BlueprintJSON {
    return { signal: this.signal.toDict(), networks: networks(this.signal), copy_count_from_input: this.count === null, ...(this.count === null ? {} : { constant: this.count }) };
  }
}

export interface DeciderOptions { name: string; when: Expression; outputs: readonly Output[]; }
export class Decider {
  readonly name: string;
  readonly when: Expression;
  readonly outputs: readonly Output[];
  constructor({ name, when, outputs }: DeciderOptions) {
    nonempty(name, 'Decider needs a name');
    if (!(when instanceof Expression)) throw new TypeError('when must be an Expression; use signal.equals() instead of ===');
    if (!Array.isArray(outputs) || !outputs.length || outputs.some(o => !(o instanceof Output))) throw new TypeError('outputs must contain at least one Output');
    this.name = name; this.when = when; this.outputs = Object.freeze([...outputs]); Object.freeze(this);
      record(this);
  }
  toEntity(number: number): BlueprintJSON {
    return { entity_number: number, name: 'decider-combinator', position: { x: (number - 1) * 3 + 0.5, y: 0 }, control_behavior: { decider_conditions: { conditions: this.when.toConditions(), outputs: this.outputs.map(o => o.toDict()) } } };
  }
}
/** Build a decider using named options. */
export function decider(options: DeciderOptions): Decider { return new Decider(options); }

/** Named arithmetic operations. Literal symbols remain accepted for existing scripts. */
export const Operation = Object.freeze({
  ADD: '+', SUBTRACT: '-', MULTIPLY: '*', DIVIDE: '/', MODULO: '%', POWER: '^',
  SHIFT_LEFT: '<<', SHIFT_RIGHT: '>>', AND: 'AND', OR: 'OR', XOR: 'XOR',
} as const);
export type ArithmeticOperator = typeof Operation[keyof typeof Operation];

/** One arithmetic operation, evaluated once per game tick. */
export class Arithmetic {
  readonly name: string; readonly left: number | Signal; readonly right: number | Signal;
  readonly operation: ArithmeticOperator; readonly output: Signal;
  constructor({name, left, operation, right, output}: {name: string; left: number | Signal; operation: ArithmeticOperator; right: number | Signal; output: Signal}) {
    nonempty(name, 'Arithmetic needs a name');
    if (!(left instanceof Signal)) int32(left);
    if (!(right instanceof Signal)) int32(right);
    if (!Object.values(Operation).includes(operation)) throw new TypeError('Unknown arithmetic operation');
    if (!(output instanceof Signal)) throw new TypeError('output must be a Signal');
    this.name=name; this.left=left; this.operation=operation; this.right=right; this.output=output;
    Object.freeze(this); record(this);
  }
  toEntity(number: number): BlueprintJSON {
    const operand = (value: Signal | number, slot: string) => value instanceof Signal ? {[`${slot}_signal`]: value.toDict(), [`${slot}_signal_networks`]: networks(value)} : {[`${slot}_constant`]: value};
    return {entity_number:number,name:'arithmetic-combinator',position:{x:(number-1)*3+.5,y:0},control_behavior:{arithmetic_conditions:{...operand(this.left,'first'),operation:this.operation,...operand(this.right,'second'),output_signal:this.output.toDict()}}};
  }
}
/** A continuous source. Use a circuit input or disable it in-game for pulses. */
export class Constant {
  readonly name: string; readonly outputs: readonly Output[];
  readonly enabled: boolean;
  constructor({name, outputs, enabled = true}: {name: string; outputs: readonly Output[]; enabled?:boolean}) {
    nonempty(name,'Constant needs a name');
    if (!Array.isArray(outputs) || !outputs.length || outputs.some(o => !(o instanceof Output) || o.count === null || ['signal-each','signal-anything','signal-everything'].includes(o.signal.name))) throw new TypeError('Constant needs fixed, ordinary signal outputs');
    if(typeof enabled!=='boolean') throw new TypeError('enabled must be a boolean');
    this.name=name; this.outputs=Object.freeze([...outputs]); this.enabled=enabled; Object.freeze(this); record(this);
  }
  toEntity(number: number): BlueprintJSON {
    return {entity_number:number,name:'constant-combinator',position:{x:(number-1)*3+.5,y:0},control_behavior:{...(this.enabled?{}:{is_on:false}),sections:{sections:[{index:1,filters:this.outputs.map((o,i)=>({index:i+1,...o.signal.toDict(),quality:o.signal.quality??'normal',comparator:'=',count:o.count}))}]}}};
  }
}
/** Source-only tutorial placeholder. Devices and their wires are omitted from exports. */
export class Device {
  readonly name: string; readonly prototype: 'small-lamp' | 'pump' | 'transport-belt'; readonly when?: Expression;
  constructor({name,prototype,when}: {name:string;prototype:'small-lamp'|'pump'|'transport-belt';when?:Expression}) {
    nonempty(name,'Device needs a name');
    if(!['small-lamp','pump','transport-belt'].includes(prototype)) throw new TypeError('Unsupported device prototype');
    if(prototype!=='transport-belt' && (!(when instanceof Expression)||when.toConditions().length!==1)) throw new TypeError('Device needs one condition');
    this.name=name;this.prototype=prototype;this.when=when;Object.freeze(this);record(this);
  }
  toEntity(number:number):BlueprintJSON {
    const condition = this.when?.toConditions()[0];
    if(condition){delete condition.first_signal_networks;delete condition.second_signal_networks;}
    return {entity_number:number,name:this.prototype,position:{x:(number-1)*3+.5,y:0},...(this.prototype==='transport-belt'?{direction:8}:{}),control_behavior:this.prototype==='transport-belt'?{circuit_enabled:false,circuit_read_hand_contents:true,circuit_contents_read_mode:0}:{circuit_enabled:true,circuit_condition:condition!}};
  }
}
export type CircuitEntity = Decider | Arithmetic | Constant | Device | Driver;
export type Combinator = Decider | Arithmetic | Constant;
export const WireColor = Object.freeze({ RED: 'red', GREEN: 'green' } as const);
export type WireColor = typeof WireColor[keyof typeof WireColor];
export const Port = Object.freeze({ INPUT: 'input', OUTPUT: 'output' } as const);
export type Port = typeof Port[keyof typeof Port];
export interface WireOptions { color?: WireColor; sourcePort?: Port; targetPort?: Port; }
/** Connect ports. Output-to-input is the default; use output-to-output to join buses. */
export function wire(source: CircuitEntity, target: CircuitEntity, options?: WireOptions): void;
export function wire(source: CircuitEntity, target: CircuitEntity, color?: WireColor, sourcePort?: Port, targetPort?: Port): void;
export function wire(source: CircuitEntity, target: CircuitEntity, options: WireOptions | WireColor = {}, sourcePort: Port = Port.OUTPUT, targetPort: Port = Port.INPUT): void {
  if (options === null || (typeof options !== 'object' && typeof options !== 'string') || Array.isArray(options)) throw new TypeError('Invalid wire options');
  const color = typeof options === 'string' ? options : options?.color ?? WireColor.RED;
  if(typeof options !== 'string') {sourcePort=options?.sourcePort??Port.OUTPUT;targetPort=options?.targetPort??Port.INPUT;}
  if (![source,target].every(e=>e instanceof Decider || e instanceof Arithmetic || e instanceof Constant || e instanceof Device || e instanceof Driver)) throw new TypeError('Wire endpoints must be circuit entities');
  if (!['red','green'].includes(color) || ![sourcePort,targetPort].every(p=>['input','output'].includes(p))) throw new TypeError('Invalid wire color or port');
  session.wires.push([source,target,color,sourcePort,targetPort]);
}

export class Blueprint {
  readonly deciders: readonly Decider[];
  readonly entities: readonly CircuitEntity[];
  constructor(entities: readonly CircuitEntity[], readonly label = 'CircuitMaker') {
    if (!Array.isArray(entities) || !entities.length || entities.some(e => !(e instanceof Decider || e instanceof Arithmetic || e instanceof Constant || e instanceof Device || e instanceof Driver))) throw new TypeError('Blueprint requires circuit entities');
    this.entities=Object.freeze([...entities]);
    this.deciders = Object.freeze(entities.filter((e):e is Decider=>e instanceof Decider)); Object.freeze(this);
  }
  toDict(): BlueprintJSON {
    return serializeGraph(this.entities,this.label,session.wires);
  }
  toString(): string { return encode(this.toDict()); }
}
export function encode(data: BlueprintJSON): string {
  const bytes = zlibSync(strToU8(JSON.stringify(data)), { level: 9 });
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return '0' + btoa(binary);
}


/** A virtual signal source for simulations; never exported in a Factorio blueprint. */
export class Driver {
  readonly name: string;
  private initial: readonly Output[];
  private events: { tick:number; signals:readonly Output[]; duration?:number; reset_others?:boolean }[] = [];
  constructor({name, signals=[]}: {name:string; signals?:readonly Output[]}) {
    nonempty(name,'Driver needs a name'); this.name=name;this.initial=this.validate(signals);record(this);
  }
  private validate(signals:readonly Output[]) {
    if(!Array.isArray(signals)||signals.some(o=>!(o instanceof Output)||o.count===null||['signal-each','signal-anything','signal-everything'].includes(o.signal.name))) throw new TypeError('Driver signals must be fixed, ordinary signal outputs');
    return [...signals];
  }
  /** Update held signals from this tick onward. Set resetOthers to clear omitted signals. */
  at(tick:number, signals:readonly Output[], resetOthers=false):this {
    if(!Number.isInteger(tick)||tick<0||tick>2000)throw new RangeError('Driver tick must be 0..2000');
    if(typeof resetOthers!=='boolean')throw new TypeError('resetOthers must be a boolean');
    this.events.push({tick,signals:this.validate(signals),reset_others:resetOthers});return this;
  }
  /** Add a signal set for duration ticks, on top of the held values. */
  pulse(tick:number, signals:readonly Output[], duration=1):this {
    if(!Number.isInteger(tick)||tick<0||tick>2000||!Number.isInteger(duration)||duration<1||duration>2000)throw new RangeError('Invalid pulse tick or duration');
    this.events.push({tick,signals:this.validate(signals),duration});return this;
  }
  toEntity(number:number):BlueprintJSON {
    const encodeSignals=(values:readonly Output[])=>values.map(o=>({signal:o.signal.toDict(),count:o.count}));
    return {entity_number:number,name:'circuitmaker-driver',position:{x:(number-1)*3+.5,y:0},driver:{initial:encodeSignals(this.initial),events:this.events.map(e=>({tick:e.tick,signals:encodeSignals(e.signals),...(e.duration===undefined?{reset_others:e.reset_others}:{duration:e.duration})}))}};
  }
}

/** Capture a deterministic tick timeline after the authoring script finishes. */
export class Simulation {
  readonly entities:readonly (Combinator|Driver)[];
  readonly name:string;readonly ticks:number;
  private expectations:{tick:number;entity:Combinator|Driver;signals:readonly Output[];color?:WireColor;port?:Port}[]=[];
  constructor({entities,ticks,name='Simulation'}:{entities:readonly (Combinator|Driver)[];ticks:number;name?:string}) {
    nonempty(name,'Simulation needs a name');
    if(!Number.isInteger(ticks)||ticks<1||ticks>2000)throw new RangeError('Simulation ticks must be 1..2000');
    if(!Array.isArray(entities)||!entities.length||entities.length>256||entities.some(e=>!(e instanceof Decider||e instanceof Arithmetic||e instanceof Constant||e instanceof Driver)))throw new TypeError('Simulation requires up to 256 combinators and Drivers');
    this.entities=[...new Set(entities)];this.name=name;this.ticks=ticks;
    if(session.active)session.simulations.push(this);
  }
  /** Expect specific signal counts at a tick. Checked by Run and by .run().
   * Omit color to check the entity's own output; pass color to check its network.
   * Only listed signals are checked; use output(0) to expect an absent signal.
   */
  expect(tick:number,entity:Combinator|Driver,signals:readonly Output[],{color,port}: {color?:WireColor;port?:Port}={}):this {
    if(!Number.isInteger(tick)||tick<0||tick>this.ticks)throw new RangeError(`Expectation tick must be 0..${this.ticks}`);
    if(!this.entities.includes(entity))throw new TypeError('Expected entity is not part of this simulation');
    if(!Array.isArray(signals)||!signals.length||signals.some(o=>!(o instanceof Output)||o.count===null||['signal-each','signal-anything','signal-everything'].includes(o.signal.name)))throw new TypeError('Expectations require fixed counts for specific signals');
    if((color!==undefined&&!['red','green'].includes(color))||(port!==undefined&&!['input','output'].includes(port))||(port!==undefined&&color===undefined))throw new TypeError('Network expectations require a valid color and port');
    if(color!==undefined&&(entity instanceof Constant||entity instanceof Driver)&&(port??'input')==='input')throw new TypeError('Constants and Drivers have output ports only');
    this.expectations.push({tick,entity,signals:[...signals],...(color===undefined?{}:{color,port:port??'input'})});
    return this;
  }
  /** Run a fresh snapshot of the circuit as currently configured, for script assertions. */
  run():SimulationResult {
    const members=[...this.entities.filter(e=>!(e instanceof Driver)),...this.entities.filter(e=>e instanceof Driver)];
    return new SimulationResult(simulateScenario(this.toPlan()),members);
  }
  toPlan():unknown {
    const real=this.entities.filter(e=>!(e instanceof Driver)),drivers=this.entities.filter((e):e is Driver=>e instanceof Driver);
    const members=[...real,...drivers],numbers=new Map(members.map((e,i)=>[e,i+1]));
    const data:any=serializeGraph(real,this.name,session.wires,true);
    const bottom=Math.max(0,...data.blueprint.entities.map((e:any)=>e.position.y))+3;
    data.blueprint.entities.push(...drivers.map((d,i)=>({...d.toEntity(real.length+i+1),position:{x:i*3+.5,y:bottom}})));
    data.blueprint.description=members.map((e,i)=>`${i+1}: ${e.name}`).join('\n');
    const port=(e:Combinator|Driver,p:string,c:string)=>(e instanceof Constant||e instanceof Driver||p==='input'?1:3)+(c==='green'?1:0);
    data.blueprint.wires=session.wires.filter(([a,b])=>numbers.has(a as Combinator|Driver)&&numbers.has(b as Combinator|Driver)).map(([a,b,c,ap,bp])=>[numbers.get(a as Combinator|Driver),port(a as Combinator|Driver,ap,c),numbers.get(b as Combinator|Driver),port(b as Combinator|Driver,bp,c)]);
    const expectations=this.expectations.map(e=>({tick:e.tick,entity:numbers.get(e.entity),signals:e.signals.map(o=>({signal:o.signal.toDict(),count:o.count})),...(e.color===undefined?{}:{color:e.color,port:e.port})}));
    return {name:this.name,ticks:this.ticks,data,expectations};
  }
}

/** A snapshot returned by Simulation.run(). Absent signals read as zero. */
export class SimulationResult {
  constructor(private readonly result:any, private readonly members:readonly (Combinator|Driver)[]) {}
  private lookup(tick:number,entity:Combinator|Driver,signal:Signal) {
    if(!Number.isInteger(tick)||tick<0||tick>this.result.timeline.ticks)throw new RangeError(`Tick must be 0..${this.result.timeline.ticks}`);
    const id=this.members.indexOf(entity)+1;
    if(!id)throw new Error('Entity is not part of this simulation');
    if(!(signal instanceof Signal)||['signal-each','signal-anything','signal-everything'].includes(signal.name))throw new TypeError('Read a specific signal, not a wildcard');
    const index=this.result.timeline.signals.findIndex((s:any)=>s.type===signal.type&&s.name===signal.name&&s.quality===(signal.quality??'normal'));
    return {id,index,frame:this.result.timeline.frames[tick]};
  }
  /** Read this entity's emitted count, before contributions from other emitters. */
  value(tick:number,entity:Combinator|Driver,signal:Signal):number {
    const {id,index,frame}=this.lookup(tick,entity,signal);
    return frame.outputs[id]?.[index]??0;
  }
  /** Read the summed wire network at an entity's port. */
  networkValue(tick:number,entity:Combinator|Driver,signal:Signal,{color,port='input'}:{color:WireColor;port?:Port}):number {
    const {id,index,frame}=this.lookup(tick,entity,signal);
    if(!['red','green'].includes(color)||!['input','output'].includes(port))throw new TypeError('Invalid wire color or port');
    const net=this.result.timeline.networks.find((n:any)=>n.color===color&&n.ports.some((p:any)=>p.entity===id&&p.port===port));
    if(!net)throw new Error('Entity has no such simulation port');
    return frame.networks[net.id]?.[index]??0;
  }
}

/** @internal Captured simulation definitions for the isolated execution worker. */
export function simulationPlans():unknown[] { return session.simulations.map(s=>s.toPlan()); }
