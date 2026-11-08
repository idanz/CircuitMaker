"""Additive browser graph API. The original Python library stays unchanged."""
from dataclasses import dataclass
from enum import Enum
from typing import Literal, Sequence
from pathlib import Path
import circuit

_entities = []
_wires = []
_simulations = []
_active = False
_original_post = circuit.Decider.__post_init__

class Operation(str, Enum):
    ADD = '+'
    SUBTRACT = '-'
    MULTIPLY = '*'
    DIVIDE = '/'
    MODULO = '%'
    POWER = '^'
    SHIFT_LEFT = '<<'
    SHIFT_RIGHT = '>>'
    AND = 'AND'
    OR = 'OR'
    XOR = 'XOR'

ArithmeticOperator = Operation | Literal['+', '-', '*', '/', '%', '^', '<<', '>>', 'AND', 'OR', 'XOR']

class WireColor(str, Enum):
    RED = 'red'
    GREEN = 'green'

class Port(str, Enum):
    INPUT = 'input'
    OUTPUT = 'output'

WireColorValue = WireColor | Literal['red', 'green']
PortValue = Port | Literal['input', 'output']

def _int32(value):
    if type(value) is not int or not -(2**31) <= value < 2**31:
        raise TypeError('Expected a signed 32-bit integer')

def _record(entity):
    if _active:
        _entities.append(entity)

def _networks(signal):
    return {'red': signal.network != 'green', 'green': signal.network != 'red'}

@dataclass(frozen=True, eq=False)
class Arithmetic:
    name: str
    left: circuit.Signal | int
    operation: ArithmeticOperator
    right: circuit.Signal | int
    output: circuit.Signal

    def __post_init__(self):
        if not isinstance(self.name, str) or not self.name:
            raise TypeError('Arithmetic needs a name')
        for value in (self.left, self.right):
            if not isinstance(value, circuit.Signal):
                _int32(value)
        if self.operation not in tuple(Operation):
            raise TypeError('Unknown arithmetic operation')
        if not isinstance(self.output, circuit.Signal):
            raise TypeError('output must be a Signal')
        _record(self)

    def to_entity(self, number):
        def operand(value, slot):
            if isinstance(value, circuit.Signal):
                return {slot+'_signal': value.to_dict(), slot+'_signal_networks': _networks(value)}
            return {slot+'_constant': value}
        return {'entity_number': number, 'name': 'arithmetic-combinator', 'position': {'x': (number-1)*3+.5, 'y': 0}, 'control_behavior': {'arithmetic_conditions': {**operand(self.left, 'first'), 'operation': self.operation, **operand(self.right, 'second'), 'output_signal': self.output.to_dict()}}}

@dataclass(frozen=True, eq=False)
class Constant:
    name: str
    outputs: tuple[circuit.Output, ...]
    enabled: bool = True

    def __post_init__(self):
        if not isinstance(self.name, str) or not self.name:
            raise TypeError('Constant needs a name')
        if not self.outputs or any(not isinstance(o, circuit.Output) or o.count is None or o.signal.name in ('signal-each','signal-anything','signal-everything') for o in self.outputs):
            raise TypeError('Constant needs fixed, ordinary signal outputs')
        object.__setattr__(self, 'outputs', tuple(self.outputs))
        if type(self.enabled) is not bool:
            raise TypeError('enabled must be a boolean')
        _record(self)

    def to_entity(self, number):
        filters = [{'index': i+1, **o.signal.to_dict(), 'quality': o.signal.quality or 'normal', 'comparator': '=', 'count': o.count} for i,o in enumerate(self.outputs)]
        return {'entity_number': number, 'name': 'constant-combinator', 'position': {'x': (number-1)*3+.5, 'y': 0}, 'control_behavior': {**({} if self.enabled else {'is_on':False}), 'sections': {'sections': [{'index':1, 'filters':filters}]}}}

@dataclass(frozen=True, eq=False)
class Device:
    """Source-only placeholder; omitted from every blueprint export."""
    name: str
    prototype: str
    when: circuit.Expression | None = None

    def __post_init__(self):
        if not isinstance(self.name,str) or not self.name:
            raise TypeError('Device needs a name')
        if self.prototype not in ('small-lamp','pump','transport-belt'):
            raise TypeError('Unsupported device prototype')
        if self.prototype != 'transport-belt' and (not isinstance(self.when,circuit.Expression) or len(self.when.to_conditions())!=1):
            raise TypeError('Device needs one condition')
        _record(self)

    def to_entity(self,number):
        condition = self.when.to_conditions()[0] if self.when is not None else None
        if condition is not None:
            condition.pop('first_signal_networks',None)
            condition.pop('second_signal_networks',None)
        return {'entity_number':number,'name':self.prototype,'position':{'x':(number-1)*3+.5,'y':0},**({'direction':8} if self.prototype=='transport-belt' else {}),'control_behavior':{'circuit_enabled':False,'circuit_read_hand_contents':True,'circuit_contents_read_mode':0} if self.prototype=='transport-belt' else {'circuit_enabled':True,'circuit_condition':condition}}


class Driver:
    """Virtual simulation source, omitted from blueprint exports."""
    def __init__(self, name: str, signals: Sequence[circuit.Output] = ()):
        if not isinstance(name,str) or not name:
            raise TypeError('Driver needs a name')
        self.name=name
        self.initial=self._validate(signals)
        self.events=[]
        _record(self)

    @staticmethod
    def _validate(signals):
        values=list(signals)
        if any(not isinstance(o,circuit.Output) or o.count is None or o.signal.name in ('signal-each','signal-anything','signal-everything') for o in values):
            raise TypeError('Driver signals must be fixed, ordinary signal outputs')
        return values

    def at(self, tick: int, signals: Sequence[circuit.Output], *, reset_others: bool = False):
        if type(tick) is not int or not 0 <= tick <= 2000:
            raise ValueError('Driver tick must be 0..2000')
        if type(reset_others) is not bool:
            raise TypeError('reset_others must be a bool')
        self.events.append({'tick':tick,'signals':self._validate(signals),'reset_others':reset_others})
        return self

    def pulse(self, tick: int, signals: Sequence[circuit.Output], duration: int = 1):
        if type(tick) is not int or not 0 <= tick <= 2000 or type(duration) is not int or not 1 <= duration <= 2000:
            raise ValueError('Invalid pulse tick or duration')
        self.events.append({'tick':tick,'signals':self._validate(signals),'duration':duration})
        return self

    def to_entity(self, number):
        def encode(values):
            return [{'signal':o.signal.to_dict(),'count':o.count} for o in values]
        return {'entity_number':number,'name':'circuitmaker-driver','position':{'x':(number-1)*3+.5,'y':0},'driver':{'initial':encode(self.initial),'events':[{**e,'signals':encode(e['signals'])} for e in self.events]}}


class Simulation:
    """Capture a timeline for explicit combinators and Drivers after this script finishes."""
    def __init__(self, entities, ticks: int, name: str = 'Simulation'):
        if not isinstance(name,str) or not name:
            raise TypeError('Simulation needs a name')
        if type(ticks) is not int or not 1 <= ticks <= 2000:
            raise ValueError('Simulation ticks must be 1..2000')
        members=_unique(entities)
        if not members or len(members)>256 or any(not _supported(e) and not isinstance(e,Driver) for e in members):
            raise TypeError('Simulation requires up to 256 combinators and Drivers')
        self.entities=tuple(members)
        self.name=name
        self.ticks=ticks
        self._expectations=[]
        if _active:
            _simulations.append(self)

    def expect(self, tick, entity, signals, *, color=None, port=None):
        """Expect signal counts at a tick, checked by Run and .run(). Returns self."""
        if type(tick) is not int or not 0 <= tick <= self.ticks:
            raise ValueError(f'Expectation tick must be 0..{self.ticks}')
        if not any(e is entity for e in self.entities):
            raise ValueError('Expected entity is not part of this simulation')
        values=list(signals)
        if not values or any(not isinstance(o,circuit.Output) or o.count is None or o.signal.name in ('signal-each','signal-anything','signal-everything') for o in values):
            raise TypeError('Expectations require fixed counts for specific signals')
        if (color is not None and color not in ('red','green')) or (port is not None and port not in ('input','output')) or (port is not None and color is None):
            raise ValueError('Network expectations require a valid color and port')
        if color is not None and isinstance(entity,(Constant,Driver)) and (port or 'input')=='input':
            raise ValueError('Constants and Drivers have output ports only')
        self._expectations.append({'tick':tick,'entity':entity,'signals':values,**({} if color is None else {'color':color,'port':port or 'input'})})
        return self

    def run(self):
        """Run a fresh snapshot now, so ordinary Python asserts can inspect it."""
        import json
        from _circuitmaker_simulation import run
        members = [e for e in self.entities if not isinstance(e, Driver)] + [e for e in self.entities if isinstance(e, Driver)]
        return SimulationResult(json.loads(run(json.dumps(self.to_plan()))), members)

    def to_plan(self):
        real=[e for e in self.entities if not isinstance(e,Driver)]
        drivers=[e for e in self.entities if isinstance(e,Driver)]
        members=real+drivers
        numbers={id(e):i+1 for i,e in enumerate(members)}
        data=_serialize(real,self.name,True)
        bp=data['blueprint']
        bottom=max([0]+[e['position']['y'] for e in bp['entities']])+3
        bp['entities'].extend({**d.to_entity(len(real)+i+1),'position':{'x':i*3+.5,'y':bottom}} for i,d in enumerate(drivers))
        bp['description']='\n'.join(f'{i+1}: {e.name}' for i,e in enumerate(members))
        def port(e,p,c):
            return (1 if isinstance(e,(Constant,Driver)) or p=='input' else 3)+(1 if c=='green' else 0)
        bp['wires']=[[numbers[id(a)],port(a,ap,c),numbers[id(b)],port(b,bp_,c)] for a,b,c,ap,bp_ in _wires if id(a) in numbers and id(b) in numbers]
        expectations=[{**e,'entity':numbers[id(e['entity'])],'signals':[{'signal':o.signal.to_dict(),'count':o.count} for o in e['signals']]} for e in self._expectations]
        return {'name':self.name,'ticks':self.ticks,'data':data,'expectations':expectations}


class SimulationResult:
    """Snapshot returned by Simulation.run(); absent signals read as zero."""
    def __init__(self, result, members):
        self._result = result
        self._members = tuple(members)

    def _lookup(self, tick, entity, signal):
        timeline = self._result['timeline']
        if type(tick) is not int or not 0 <= tick <= timeline['ticks']:
            raise ValueError(f"Tick must be 0..{timeline['ticks']}")
        number = next((i+1 for i,e in enumerate(self._members) if e is entity), None)
        if number is None:
            raise ValueError('Entity is not part of this simulation')
        if not isinstance(signal, circuit.Signal) or signal.name in ('signal-each','signal-anything','signal-everything'):
            raise TypeError('Read a specific signal, not a wildcard')
        index = next((str(i) for i,s in enumerate(timeline['signals']) if s['type']==signal.type and s['name']==signal.name and s['quality']==(signal.quality or 'normal')), None)
        return number, index, timeline['frames'][tick]

    def value(self, tick, entity, signal):
        """Read this entity's own emitted count, before other emitters are added."""
        number, index, frame = self._lookup(tick, entity, signal)
        return frame['outputs'].get(str(number), {}).get(index, 0)

    def network_value(self, tick, entity, signal, *, color, port=Port.INPUT):
        """Read the summed wire network at an entity's port."""
        number, index, frame = self._lookup(tick, entity, signal)
        if color not in ('red','green') or port not in ('input','output'):
            raise ValueError('Invalid wire color or port')
        network = next((n for n in self._result['timeline']['networks'] if n['color']==color and any(p['entity']==number and p['port']==port for p in n['ports'])), None)
        if network is None:
            raise ValueError('Entity has no such simulation port')
        return frame['networks'][network['id']].get(index, 0)


def collect_simulations():
    return [scenario.to_plan() for scenario in _simulations]


def wire(source, target, color: WireColorValue = WireColor.RED, source_port: PortValue = Port.OUTPUT, target_port: PortValue = Port.INPUT):
    """Join ports; output-to-output joins output buses without adding a tick."""
    if not all(isinstance(e, (circuit.Decider, Arithmetic, Constant, Device, Driver)) for e in (source,target)):
        raise TypeError('Wire endpoints must be circuit entities')
    if color not in ('red','green') or source_port not in ('input','output') or target_port not in ('input','output'):
        raise TypeError('Invalid wire color or port')
    _wires.append((source,target,color,source_port,target_port))

def _capture(entity):
    _original_post(entity)
    _record(entity)

def begin():
    global _active
    _entities.clear()
    _wires.clear()
    _simulations.clear()
    _active = True
    circuit.Decider.__post_init__ = _capture

def end():
    global _active
    circuit.Decider.__post_init__ = _original_post
    _active = False
    _entities.clear()
    _wires.clear()
    _simulations.clear()

def _supported(entity):
    return isinstance(entity, (circuit.Decider, Arithmetic, Constant))

def _unique(entities):
    seen, result = set(), []
    for e in entities:
        if id(e) not in seen:
            seen.add(id(e))
            result.append(e)
    return result

def _components(entities, wires):
    remaining = {id(e) for e in entities}
    result = []
    for seed in entities:
        if id(seed) not in remaining:
            continue
        found = {id(seed)}
        changed = True
        while changed:
            changed = False
            for a,b,*_ in wires:
                if id(a) in found and id(b) in remaining and id(b) not in found:
                    found.add(id(b))
                    changed = True
                if id(b) in found and id(a) in remaining and id(a) not in found:
                    found.add(id(a))
                    changed = True
        result.append([e for e in entities if id(e) in found])
        remaining.difference_update(found)
    return result

def _serialize(members, label, force_packed=False):
    supported = [e for e in members if _supported(e)]
    included = {id(e) for e in supported}
    wires = [(a,b,c,ap,bp) for a,b,c,ap,bp in _wires if id(a) in included and id(b) in included]
    legacy = not force_packed and not wires and all(isinstance(e,circuit.Decider) for e in supported)
    entities = supported if legacy else _unique(supported)
    numbers = {id(e):i+1 for i,e in enumerate(entities)}
    positions = {}
    if not legacy:
        x, y, row_height = 0, 0, 0
        for group in _components(entities,wires):
            width, height = min(len(group),4)*2, ((len(group)+3)//4)*2
            if x and x+width>24:
                x, y, row_height = 0, y+row_height+3, 0
            for i,e in enumerate(group):
                positions[id(e)] = {'x':x+(i%4)*2+.5,'y':y+(i//4)*2+(.5 if isinstance(e,Constant) else 0)}
            x += width+3
            row_height = max(row_height,height)
    def port(e,p,c):
        return (1 if isinstance(e,Constant) or p=='input' else 3)+(1 if c=='green' else 0)
    encoded, seen = [], set()
    for a,b,c,ap,bp in wires:
        left, right = (numbers[id(a)],port(a,ap,c)), (numbers[id(b)],port(b,bp,c))
        edge = (*min(left,right),*max(left,right))
        if edge not in seen:
            seen.add(edge)
            encoded.append(list(edge))
    return {'blueprint': {'item':'blueprint','label':label,'version':(2<<48)|(36<<16),'description':'\n'.join(f'{i+1}: {e.name}' for i,e in enumerate(entities)),'entities':[{**e.to_entity(i+1), **({} if legacy else {'position':positions[id(e)]})} for i,e in enumerate(entities)], **({'wires':encoded} if encoded else {})}}

@dataclass(frozen=True, init=False)
class Blueprint:
    """Group combinators and their internal wires. Device placeholders are omitted."""
    entities: tuple
    label: str = 'CircuitMaker'

    def __init__(self, entities=None, label='CircuitMaker', *, deciders=None):
        if entities is not None and deciders is not None:
            raise TypeError('Provide entities or the legacy deciders argument, not both')
        members = tuple(entities if entities is not None else deciders or ())
        if not members or any(not isinstance(e,(circuit.Decider,Arithmetic,Constant,Device)) for e in members):
            raise TypeError('Blueprint requires circuit entities')
        object.__setattr__(self,'entities',members)
        object.__setattr__(self,'label',label)

    @property
    def deciders(self):
        return tuple(e for e in self.entities if isinstance(e,circuit.Decider))

    def to_dict(self):
        return _serialize(self.entities,self.label)

    def to_string(self):
        return circuit.encode(self.to_dict())

    def save(self,path):
        Path(path).write_text(self.to_string()+'\n',encoding='utf-8')

def collect(namespace):
    groups = [(n,v) for n,v in namespace.items() if not n.startswith('_') and isinstance(v,Blueprint) and any(_supported(e) for e in v.entities)]
    artifacts = [{'name':n,'label':f'{n} (export)' if n.lower()=='all' else n,'kind':'named','data':bp.to_dict(),'string':bp.to_string()} for n,bp in groups]
    covered = {id(e) for _,bp in groups for e in bp.entities}
    all_created = _unique([*_entities,*(e for _,bp in groups for e in bp.entities)])
    supported = [e for e in all_created if _supported(e)]
    singletons = set()
    for _,bp in groups:
        members=[e for e in bp.entities if _supported(e)]
        if len(members)==1:
            singletons.add(id(members[0]))
    remaining = [e for e in supported if id(e) not in covered]
    for entities in _components(remaining,_wires):
        if len(entities)==1:
            singletons.add(id(entities[0]))
        label, suffix = entities[0].name, 2
        name = label
        while any(a['name']==name for a in artifacts):
            name = f'{label} ({suffix})'
            suffix += 1
        data = _serialize(entities,label)
        artifacts.append({'name':name,'label':f'{name} (export)' if name.lower()=='all' else name,'kind':'component','data':data,'string':circuit.encode(data)})
    for entity in supported:
        if id(entity) in singletons:
            continue
        base=f'{entity.name} ({type(entity).__name__})'
        name, suffix = base, 2
        while any(a['name']==name for a in artifacts):
            name=f'{base} ({suffix})'
            suffix+=1
        data=_serialize([entity],entity.name)
        artifacts.append({'name':name,'label':name,'kind':'entity','data':data,'string':circuit.encode(data)})
    if supported:
        name = '__all__'
        while any(a['name']==name for a in artifacts):
            name += '.'
        data = _serialize(supported,'All',True)
        artifacts.insert(0,{'name':name,'label':'All','kind':'all','data':data,'string':circuit.encode(data)})
    omitted = sum(isinstance(e,Device) for e in all_created)
    if omitted:
        print(f'Omitted {omitted} Device placeholder(s) and their wires; only combinators are exported.')
    return artifacts

def install():
    circuit.Blueprint = Blueprint
    circuit.WireColor = WireColor
    circuit.Port = Port
    circuit.WireColorValue = WireColorValue
    circuit.PortValue = PortValue
    circuit.Operation = Operation
    circuit.ArithmeticOperator = ArithmeticOperator
    circuit.Arithmetic = Arithmetic
    circuit.Constant = Constant
    circuit.Device = Device
    circuit.Driver = Driver
    circuit.Simulation = Simulation
    circuit.SimulationResult = SimulationResult
    circuit.wire = wire
