// Author recipes once; emit ordinary, editable Python and TypeScript sources.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const recipes=[];
const d=(id,name,left,op,right,outputs)=>({id,kind:'Decider',name,condition:[left,op,right],outputs});
const a=(id,name,left,operation,right,output)=>({id,kind:'Arithmetic',name,left,operation,right,output});
const c=(id,name,outputs,enabled=true)=>({id,kind:'Constant',name,outputs,enabled});
const device=(id,name,prototype,condition)=>({id,kind:'Device',name,prototype,condition});
const w=(from,to,color='red',sourcePort='output',targetPort='input')=>({from,to,color,sourcePort,targetPort});
function recipe(id,title,section,description,entities,wires=[]){recipes.push({id,title,section,description,entities,wires});}
recipe('01-everything','Everything wildcard','Virtual_signals','Input: any signal bus. Output: all incoming counts, one tick later, if every present count is positive. An empty bus satisfies this universal test; copying an empty bus still emits nothing.',[d('test','Everything wildcard','EVERYTHING','>',0,[['EVERYTHING',null]])]);
recipe('02-anything','Anything wildcard','Virtual_signals','Input: any signal bus. Output: A=1, one tick later, if at least one present count is positive. Empty input produces no A. This is useful as a busy flag.',[d('test','Anything wildcard','ANYTHING','>',0,[['A',1]])]);
recipe('03-each-filter','Each filter','Virtual_signals','Input: mixed signed counts. Output: the positive signals with their original counts, one tick later. Each tests and copies every qualifying channel separately.',[d('test','Each filter','EACH','>',0,[['EACH',null]])]);
recipe('04-each-count','Each input-only count','Virtual_signals','Input: mixed signals. Output: A counts how many channels have positive values. Fixed output 1 is contributed once per matching channel; the resulting A is a count of channels, not items.',[d('test','Count positive channels','EACH','>',0,[['A',1]])]);
recipe('05-each-sum','Each input-only sum','Virtual_signals','Input: mixed signals. Output: A is the sum of positive input counts after one tick. Changing the output from Each to A combines the per-channel results into one total.',[d('test','Sum positive counts','EACH','>',0,[['A',null]])]);
recipe('06-arithmetic-map','Arithmetic Each map','Virtual_signals','Input: any signal bus. Output: every count multiplied by two after one tick. Each on both sides preserves the signal names. Arithmetic uses signed 32-bit counts; overflow wraps.',[a('scale','Double each channel','EACH','*',2,'EACH')]);
recipe('07-arithmetic-sum','Arithmetic Each reduction','Virtual_signals','Input: any signal bus. Output: A is twice the sum of all input counts. Each on the left and a named output reduces the mapped values into one signal.',[a('sum','Sum doubled channels','EACH','*',2,'A')]);
recipe('08-insulator','Input insulator','Input_insulator_&_gate','Attach the upstream bus to the input and a separate downstream bus to the output. Counts cross with a one-tick delay. Downstream feedback cannot travel backwards through this arithmetic operation; either wire color can be used on each side.',[a('isolate','Input insulator','EACH','+',0,'EACH')]);
recipe('09-gate','Conditional bus gate','Input_insulator_&_gate','Feed the data and an enable channel E into the input. When E is positive, all input channels, including E, are copied one tick later. When E is absent or nonpositive the gate emits nothing. Keep input and output networks separate.',[d('gate','Enabled bus gate','E','>',0,[['EVERYTHING',null]])]);
recipe('10-sr-bias','Biased SR switch','Set/Reset_latching_switch','External input: A. Output: S=1 after A reaches 100. Feedback adds 60 to A while active, so the switch stays on until A drops below 40. The feedback path adds two ticks of latency; hold set/reset inputs until it settles. Read S at the decider output.',[d('latch','Biased SR switch','A','>=',100,[['S',1]]),a('bias','Hold bias 60','S','*',60,'A')],[w('latch','bias'),w('bias','latch','green')]);
recipe('11-oil-pump','Light oil pump hysteresis','Set/Reset_latching_switch','Connect tank light-oil counts to the latch input with red wire. The pump enables at 20000 and holds while the tank is at least 5000; it disables below 5000 after feedback settles. The inclusive comparator means exactly 5000 remains enabled. Attach the pump to pipes in-game; this blueprint supplies its circuit control.',[d('latch','Light oil pump hysteresis','fluid:light-oil','>=',20000,[['S',1]]),a('bias','Light oil hold bias','S','*',15000,'fluid:light-oil'),device('pump','Controlled pump','pump',['S','>',0])],[w('latch','bias'),w('bias','latch','green'),w('latch','pump')]);
recipe('12-positive-memory','Positive feedback memory','Basic_memory','Pulse a positive A into the red input for one tick, then remove it. The green loop stores the running total while it is positive. A negative pulse subtracts; a total at or below zero clears the stored output. A continuously held input adds on every tick.',[d('memory','Positive feedback memory','A','>',0,[['A',null]])],[w('memory','memory','green')]);
recipe('13-signed-memory','Signed feedback memory','Basic_memory','Pulse signed A values into the red input. The green feedback loop accumulates them and holds any nonzero total. An opposite pulse of the current total clears it. This is an accumulator: a held value repeatedly adds rather than replacing memory.',[d('memory','Signed feedback memory','A','!=',0,[['A',null]])],[w('memory','memory','green')]);
recipe('14-runaway-memory','Constant-driven memory','Basic_memory','The constant injects A=1 every tick. Read the red input network to see the source plus the stored value, or the green output for the previous sampled total. Disable the constant to stop counting. Signed counts eventually wrap; a positive-only memory would clear on negative overflow.',[d('memory','Constant-driven memory','A','!=',0,[['A',null]]),c('step','Increment each tick',[['A',1]])],[w('memory','memory','green'),w('step','memory')]);
recipe('15-belt-counter','Belt pulse counter','Basic_memory','Place items on the connected belt. It reads hand contents in pulse mode, adding each detected item once to its own signal count. The decider stores all nonzero item totals through its green feedback. Read the memory output; do not change the belt to hold mode, which would count the same item repeatedly.',[d('counter','Belt item counter','ANYTHING','!=',0,[['EVERYTHING',null]]),device('belt','Pulse belt sensor','transport-belt')],[w('belt','counter'),w('counter','counter','green')]);
recipe('16-arithmetic-clock','Runaway arithmetic clock','Basic_clocks','No external input is needed. The combinator adds one to C each tick and feeds the result back. Read its green output. It has no automatic reset and wraps at the signed 32-bit boundary. Adding other C counts changes the rate.',[a('clock','Runaway arithmetic clock','C','+',1,'C')],[w('clock','clock','green')]);
recipe('17-clock','Thirty tick clock','Basic_clocks','The constant emits C=1. The shared input bus cycles through 1 to 30; the decider output cycles through 0 to 29. Read the input bus for the 1-based sequence. One full period is 30 ticks, or half a second at 60 updates per second.',[d('clock','Thirty tick clock','C','<',30,[['C',null]]),c('step','Clock increment',[['C',1]])],[w('step','clock'),w('clock','clock')]);
recipe('18-single-clock','Single combinator clock','Basic_clocks','Both outputs share the C<59 condition: copied C plus fixed C=1. When the condition fails both stop, producing zero for one tick. The green feedback therefore cycles 0..59, giving a 60-tick period without an external constant. This differs from the constant-fed clock, whose input bus never reaches zero.',[d('clock','Single combinator clock','C','<',59,[['C',null],['C',1]])],[w('clock','clock','green')]);
recipe('19-once-clock','One-time clock','Basic_clocks','This recreates the tutorial feedback topology: the tick decider emits T=1 while T<Z; the storage decider holds T while R=0. Z is 180. Reset is initially disabled: enable its constant in-game briefly, then disable it. Observe both networks when stepping; the tick and storage stages introduce a pipeline delay.',[d('tick','One-time clock','T','<','Z',[['T',1]]),c('limit','Target Z=180',[['Z',180]]),c('reset','Enable to reset',[['R',1]],false),d('hold','Clock storage','R','=',0,[['T',null]])],[w('limit','tick','green'),w('reset','hold','green'),w('tick','hold'),w('hold','tick'),w('hold','hold','green')]);
recipe('20-pulse','Periodic pulse generator','Pulse_generators','The clock input bus cycles C=1..30. A second decider detects C=30 and emits P=1 for one tick, delayed by its evaluation. The lamp follows P with its own circuit evaluation. Pulses repeat every 30 ticks (0.5 seconds at 60 TPS); pulse width is one tick, not 1/30 second.',[d('clock','Periodic pulse generator','C','<',30,[['C',null]]),c('step','Clock increment',[['C',1]]),d('pulse','End-of-cycle pulse','C','=',30,[['P',1]]),device('lamp','Pulse indicator','small-lamp',['P','>',0])],[w('step','clock'),w('clock','clock'),w('clock','pulse','red','input','input'),w('pulse','lamp')]);
function edge(rising=false){const entities=[a('source',rising?'Rising edge detector':'Signed edge detector','A','+',0,'A'),a('delay','Delayed negation','A','*',-1,'A')];const wires=[w('source','delay'),w('source','delay','green','output','output')];if(rising){entities.push(d('rise','Keep positive deltas','A','>',0,[['P',1]]));wires.push(w('delay','rise','green'));}return {entities,wires};}
for(const rising of [false,true]){const e=edge(rising);recipe(rising?'22-rising-edge':'21-edge',rising?'Rising edge detector':'Signed edge detector','Edge_detectors',rising?'Feed A into the source. Its green output bus subtracts the previous sample; a filter emits P=1 only for positive deltas. Falling edges disappear. Source insulation plus the filter add two ticks before the event output. Larger positive changes also produce a unit event.':'Feed A into the source. The source output joins the delayed negation output on green; read that green bus for current-minus-previous A. A 0→1 change produces +1 for a tick, and 1→0 produces -1. The source isolator contributes one tick of delay.',e.entities,e.wires);}
recipe('23-event-counter','Pulse event counter','Counter','Pulse N=1 on the red input once per event and leave it absent between events. The green loop accumulates signed N values. Read the green output for the count. Sending N=5 adds five, while holding N=1 counts ticks; neither is a replacement write.',[d('counter','Pulse event counter','N','!=',0,[['N',null]])],[w('counter','counter','green')]);
recipe('24-simple-latch','Simple latch from the truth table','Memory_cells','External red signals: S is Set and R is Reset. Feedback carries S on green. The next S equals the combined S count only when S>R. With unit inputs, simultaneous Set+Reset cannot set a clear latch, but a held latch can remain on and reach 2. This deliberately preserves the tutorial table behavior; it is not a strict reset-priority Boolean latch.',[d('latch','Simple tutorial latch','S','>','R',[['S',null]])],[w('latch','latch','green')]);
recipe('25-positive-cell','Positive value cell','Memory_cells','Feed I on the red input bus shared by both deciders. Positive I passes as I; after removal, M carries the remembered value. Read the red bus at the arithmetic input, where the two decider outputs merge. Negative I clears the memory after the pipeline settles. Hold writes for multiple ticks: a one-tick write can alternate between two old values.',[d('write_gate','Positive value cell','I','>',0,[['I',null]]),d('hold','Read remembered value','I','=',0,[['M',null]]),a('rename','Store as M','M','+','I','M')],[w('write_gate','hold','red','input','input'),w('write_gate','rename'),w('hold','rename'),w('rename','hold','green')]);
recipe('26-signed-cell','Signed value cell','Memory_cells','Write signed nonzero I at the first arithmetic input. Read M on the red output bus at the storage decider. Reset R connects ONLY to that decider input on red; keep it off the green write-control bus. A one-tick write survives. Reset clears an idle cell. The write path normally wins during a simultaneous write/reset, but opposing R counts can cancel: schedule resets while I is zero. Allow the three-stage pipeline to settle and keep unrelated R off both buses.',[a('write','Signed value cell','I','*',1,'R'),a('rename','Rename write to M','R','*',1,'M'),d('hold','Hold while no write or reset','R','=',0,[['M',null]])],[w('write','rename','green'),w('rename','hold','green','input','input'),w('rename','hold'),w('hold','hold')]);
recipe('27-scalar-product','Scalar multiplication','Multiplier_and_Dictionaries/Arrays','Feed counts on A and B. The output P is A×B one tick later. Absent operands read as zero. Counts use signed 32-bit integer arithmetic, so large products wrap. This handles two named channels, unlike the per-channel vector circuit.',[a('product','Scalar multiplication','A','*','B','P')]);
function vector(prefix='') {
 const entities=[a('isolate','Vector product: isolate A','EACH@red','+',0,'EACH'),a('sum','Add vectors','EACH','+',0,'EACH'),a('negate','Negate B','EACH@green','*',-1,'EACH'),a('difference_square','Square A minus B','EACH','^',2,'EACH'),a('sum_square','Square A plus B','EACH','^',2,'EACH'),a('negative_quarter','Subtract difference square','EACH','/',-4,'EACH'),a('positive_quarter','Add sum square','EACH','/',4,'EACH')];
 const wires=[w('isolate','difference_square'),w('negate','difference_square','green'),w('sum','sum_square'),w('difference_square','negative_quarter'),w('sum_square','positive_quarter'),w('negative_quarter','positive_quarter','red','output','output')];return {entities,wires};
}
function connectVectors(v,sourceA,sourceB){v.wires.push(w(sourceA,'isolate'),w(sourceA,'sum'),w(sourceB,'sum','green'),w(sourceB,'negate','green'));}
{
 const v=vector();v.entities.push(c('vector_a','Sample A',[['item:iron-plate',6],['item:copper-plate',3]]),c('vector_b','Sample B',[['item:iron-plate',4],['item:copper-plate',-2]]));connectVectors(v,'vector_a','vector_b');
 recipe('28-vector-product','Per-signal vector multiplication','Multiplier_and_Dictionaries/Arrays','Two example vectors enter the red A and green B stage-one inputs. After three combinator stages, read the joined final red output: iron plates 24 and copper plates -6. The circuit computes ((A+B)^2-(A-B)^2)/4 per channel. Keep |A+B| and |A-B| at most 46340 so the squared intermediates fit int32. Separate integer divisions cancel matching remainders.',v.entities,v.wires);
}
{
 const v=vector();v.entities.push(c('values','Dictionary values',[['item:iron-plate',42],['item:copper-plate',17]]),c('key','One-hot lookup key',[['item:copper-plate',1]]));connectVectors(v,'values','key');
 recipe('29-dictionary','Dictionary lookup','Multiplier_and_Dictionaries/Arrays','Dictionary values are keyed by signal name. The mask contains copper plates=1 and no iron signal. Read the joined final red bus: copper plates=17. Change the one-hot key to select another entry. A mask count other than one scales the value. The vector multiplier has three ticks of latency and the same squared-intermediate range limit.',v.entities,v.wires);
}
{
 const v=vector();v.entities.push(c('values','Array values',[['item:transport-belt',12],['item:fast-transport-belt',34],['item:express-transport-belt',56],['item:burner-inserter',78]]),c('mapping','Signal to array index',[['item:transport-belt',1],['item:fast-transport-belt',2],['item:express-transport-belt',3],['item:burner-inserter',4]]),c('index','Select index 3',[['X',3]]),d('mask','Index to one-hot mask','EACH@red','=','X@green',[['EACH@red',1]]));
 v.wires.push(w('mapping','mask'),w('index','mask','green'));connectVectors(v,'values','mask');
 recipe('30-array','Indexed array lookup','Multiplier_and_Dictionaries/Arrays','A constant maps four item channels to indices 1..4. X=3 selects express belts; the decider emits one unit of that channel as the dictionary mask. Read express belts=56 at the final red bus after the mask and multiplier settle. Read indices only on green so X cannot become an array element. Missing indices yield no output. Duplicate indices select multiple values.',v.entities,v.wires);
}

recipe('31-anything-output','Anything output selector','Virtual_signals','Input: a mixed bus. Output: one qualifying positive signal with its original count. Anything as an output selects a matching channel; do not rely on its iteration order when several qualify. Empty input yields no output.',[d('selector','Anything output selector','ANYTHING','>',0,[['ANYTHING',null]])]);

const methods={'>':['greater_than','greaterThan'],'>=':['at_least','atLeast'],'<':['less_than','lessThan'],'<=':['at_most','atMost'],'=':['equals','equals'],'!=':['not_equals','notEquals']};
// Each recipe owns a short demonstration rather than sharing arbitrary test inputs.
const at=(tick,values)=>({tick,values});
const pulse=(tick,values,duration=1)=>({tick,values,duration});
const drive=(id,target,events,color='red')=>({id,target,events,color});
const scenarios=new Map();
const scenario=(number,ticks,note,drivers=[])=>scenarios.set(number,{ticks,note,drivers});
for(let n=1;n<=8;n++)scenario(n,26,'The bus starts positive, changes to mixed positive/negative counts at tick 8, and clears at tick 16. Inspect the output one tick after each change.',[drive('inputs',n<=5?'test':n===6?'scale':n===7?'sum':'isolate',[at(0,[['A',4],['B',2]]),at(8,[['A',-3],['B',2]]),at(16,[])])]);
scenario(9,32,'E enables the data bus at ticks 0 and 16, disables it at tick 8, and the source clears at tick 24.',[drive('inputs','gate',[at(0,[['A',5],['E',1]]),at(8,[['A',5]]),at(16,[['A',8],['E',1]]),at(24,[])])]);
scenario(10,55,'A crosses 100, falls to 60 (held on), falls below 40 (off), then sets and resets again. Read S after the two-stage feedback settles.',[drive('inputs','latch',[at(5,[['A',110]]),at(15,[['A',60]]),at(25,[['A',39]]),at(35,[['A',100]]),at(45,[])])]);
scenario(11,65,'A Driver stands in for the tank: oil rises to 22000, drops through 10000 and 5000, then below 5000. Read S; the pump placeholder itself is not simulated.',[drive('tank','latch',[at(5,[['fluid:light-oil',22000]]),at(15,[['fluid:light-oil',10000]]),at(25,[['fluid:light-oil',5000]]),at(35,[['fluid:light-oil',4999]]),at(45,[['fluid:light-oil',25000]]),at(55,[])])]);
scenario(12,34,'One-tick A pulses add 7, subtract 3, clear the remaining 4, and store 5. Read the green memory output between pulses.',[drive('pulses','memory',[pulse(2,[['A',7]]),pulse(10,[['A',-3]]),pulse(18,[['A',-4]]),pulse(26,[['A',5]])])]);
scenario(13,34,'Signed pulses move memory through 7, -3, 0, and -5. Unlike positive-only memory, a negative stored total survives.',[drive('pulses','memory',[pulse(2,[['A',7]]),pulse(10,[['A',-10]]),pulse(18,[['A',3]]),pulse(26,[['A',-5]])])]);
scenario(14,40,'The existing constant supplies A=1 each tick. Watch the feedback total climb; no external Driver is needed.');
scenario(15,24,'A Driver substitutes for belt pulse readings: two iron plates, three copper plates, then four more iron plates. Stored totals become iron=6 and copper=3.',[drive('belt_readings','counter',[pulse(2,[['item:iron-plate',2]]),pulse(8,[['item:copper-plate',3]]),pulse(14,[['item:iron-plate',4]])])]);
scenario(16,45,'No external input is needed. Watch C increase by one each tick on the feedback output.');
scenario(17,95,'The existing constant starts the clock. The timeline covers three 30-tick cycles; compare the input bus (1..30) and decider output (0..29).');
scenario(18,125,'The timeline covers two complete 60-tick cycles, including the zero tick when both C outputs stop.');
scenario(19,430,'The clock reaches its target and holds. A reset Driver injects R for four ticks starting at 230, then the clock runs to the target again.',[drive('reset_pulse','hold',[pulse(230,[['R',1]],4)],'green')]);
scenario(20,95,'The existing constant runs the clock for three cycles. Inspect P at the pulse decider output; each pulse lasts one tick. The lamp is a source-only placeholder.');
for(const n of [21,22])scenario(n,55,'A changes 0 to 1 at tick 5, falls at 15, rises to 4 at 25, drops to 1 at 35, and clears at 45. Compare signed deltas with rising-only events.',[drive('inputs','source',[at(5,[['A',1]]),at(15,[]),at(25,[['A',4]]),at(35,[['A',1]]),at(45,[])])]);
scenario(23,36,'Three unit N pulses are followed by +5 and -2. The stored count finishes at 6; absent input between events keeps the total steady.',[drive('events','counter',[pulse(2,[['N',1]]),pulse(8,[['N',1]]),pulse(14,[['N',1]]),pulse(20,[['N',5]]),pulse(28,[['N',-2]])])]);
scenario(24,46,'Set at tick 2, reset at 12, try simultaneous Set/Reset on a clear latch at 22, then set at 30 and reset at 38. Read green S between events.',[drive('controls','latch',[pulse(2,[['S',1]]),pulse(12,[['R',1]],2),pulse(22,[['S',1],['R',1]]),pulse(30,[['S',1]]),pulse(38,[['R',1]],2)])]);
scenario(25,44,'Hold I=9 for six ticks, release it, then write 4. A held negative I clears memory at tick 30. Read M at the arithmetic input after settling.',[drive('writes','write_gate',[at(2,[['I',9]]),at(8,[]),at(16,[['I',4]]),at(22,[]),at(30,[['I',-1]]),at(34,[])])]);
scenario(26,46,'One-tick writes store -8, then 5, then -3. A separate reset Driver clears idle storage at ticks 22 and 38. Read M at the hold decider output.',[drive('writes','write',[pulse(2,[['I',-8]]),pulse(12,[['I',5]]),pulse(30,[['I',-3]])]),drive('resets','hold',[pulse(22,[['R',1]],2),pulse(38,[['R',1]],2)])]);
scenario(27,32,'Inputs demonstrate 3x4, -2x5, a missing B operand, and 2x-3. Read P one tick after each change.',[drive('inputs','product',[at(0,[['A',3],['B',4]]),at(8,[['A',-2],['B',5]]),at(16,[['A',7]]),at(24,[['A',2],['B',-3]])])]);
scenario(28,16,'The bundled constant vectors settle through the arithmetic pipeline. Read the joined final red bus: iron plates=24 and copper plates=-6.');
scenario(29,16,'The bundled dictionary and one-hot copper key settle through the multiplier. Read copper plates=17 at the final red output bus.');
scenario(30,44,'X starts at 3. Driver offsets select index 1 at tick 8, index 4 at 16, a missing index at 24, and index 3 again at 32. Allow the lookup pipeline to settle.',[drive('index_changes','mask',[at(8,[['X',-2]]),at(16,[['X',1]]),at(24,[['X',6]]),at(32,[])],'green')]);
scenario(31,34,'Only one input channel is present at a time: A=7 at tick 2, empty at 10, B=3 at 18, empty at 26. This avoids ambiguous Anything selection ordering; multiple output candidates are not yet supported by the simulator.',[drive('inputs','selector',[at(2,[['A',7]]),at(10,[]),at(18,[['B',3]]),at(26,[])])]);
// Explicit expected behavior for each demonstration: tick, entity number, signal,
// expected count, and optionally a network color/port instead of the entity output.
const checks = {
  1:[[1,1,'A',4],[9,1,'A',0],[17,1,'B',0]],
  2:[[1,1,'A',1],[9,1,'A',1],[17,1,'A',0]],
  3:[[1,1,'A',4],[9,1,'A',0],[9,1,'B',2]],
  4:[[1,1,'A',2],[9,1,'A',1]],
  5:[[1,1,'A',6],[9,1,'A',2]],
  6:[[1,1,'A',8],[9,1,'A',-6],[9,1,'B',4]],
  7:[[1,1,'A',12],[9,1,'A',-2]],
  8:[[1,1,'A',4],[9,1,'A',-3],[17,1,'B',0]],
  9:[[1,1,'A',5],[9,1,'A',0],[17,1,'A',8]],
  10:[[8,1,'S',1],[18,1,'S',1],[28,1,'S',0],[38,1,'S',1],[48,1,'S',0]],
  11:[[8,1,'S',1],[18,1,'S',1],[28,1,'S',1],[38,1,'S',0],[48,1,'S',1],[58,1,'S',0]],
  12:[[4,1,'A',7],[12,1,'A',4],[20,1,'A',0],[28,1,'A',5]],
  13:[[4,1,'A',7],[12,1,'A',-3],[20,1,'A',0],[28,1,'A',-5]],
  14:[[10,1,'A',10],[30,1,'A',30]],
  15:[[5,1,'item:iron-plate',2],[10,1,'item:copper-plate',3],[17,1,'item:iron-plate',6]],
  16:[[10,1,'C',10],[30,1,'C',30]],
  17:[[29,1,'C',29],[30,1,'C',0],[31,1,'C',1]],
  18:[[59,1,'C',59],[60,1,'C',0],[61,1,'C',1]],
  19:[[220,4,'T',181],[240,4,'T',6],[430,4,'T',181]],
  20:[[30,3,'P',1],[31,3,'P',0],[60,3,'P',1],[90,3,'P',1]],
  21:[[6,1,'A',1,'green','output'],[16,1,'A',-1,'green','output'],[26,1,'A',4,'green','output'],[36,1,'A',-3,'green','output']],
  22:[[7,3,'P',1],[17,3,'P',0],[27,3,'P',1],[37,3,'P',0]],
  23:[[16,1,'N',3],[24,1,'N',8],[32,1,'N',6]],
  24:[[4,1,'S',1],[15,1,'S',0],[24,1,'S',0],[32,1,'S',1],[41,1,'S',0]],
  25:[[14,3,'M',9,'red','input'],[28,3,'M',4,'red','input'],[42,3,'M',0,'red','input']],
  26:[[8,3,'M',-8],[18,3,'M',5],[28,3,'M',0],[36,3,'M',-3],[44,3,'M',0]],
  27:[[1,1,'P',12],[9,1,'P',-10],[17,1,'P',0],[25,1,'P',-6]],
  28:[[10,7,'item:iron-plate',24,'red','output'],[10,7,'item:copper-plate',-6,'red','output']],
  29:[[10,7,'item:copper-plate',17,'red','output'],[10,7,'item:iron-plate',0,'red','output']],
  30:[[6,7,'item:express-transport-belt',56,'red','output'],[14,7,'item:transport-belt',12,'red','output'],[22,7,'item:burner-inserter',78,'red','output'],[30,7,'item:burner-inserter',0,'red','output'],[38,7,'item:express-transport-belt',56,'red','output']],
  31:[[3,1,'A',7],[11,1,'A',0],[19,1,'B',3],[27,1,'B',0]],
};
const catalog = JSON.parse(await readFile(new URL('../public/signals/catalog.json',import.meta.url),'utf8'));
const operations={'+':'ADD','-':'SUBTRACT','*':'MULTIPLY','/':'DIVIDE','%':'MODULO','^':'POWER','<<':'SHIFT_LEFT','>>':'SHIFT_RIGHT','AND':'AND','OR':'OR','XOR':'XOR'};
let usedCatalog;
function sig(value,lang){
 if(typeof value==='number')return String(value);
 const [name,network]=value.split('@');
 const group=name.startsWith('item:')?'Items':name.startsWith('fluid:')?'Fluids':'Virtual';
 const prototype=group==='Virtual'?`signal-${['EACH','ANYTHING','EVERYTHING'].includes(name)?name.toLowerCase():name}`:name.slice(name.indexOf(':')+1);
 const entry=catalog[group].find(s=>s.name===prototype);
 if(!entry)throw new Error(`Unknown cookbook signal: ${name}`);
 usedCatalog.add(group);
 return `${group}.${entry[lang==='py'?'python':'typescript']}${network?'.'+network:''}`;
}
function condition(v,lang){return `${sig(v[0],lang)}.${methods[v[1]][lang==='py'?0:1]}(${sig(v[2],lang)})`;}
function output(v,lang){return `${sig(v[0],lang)}.${v[1]===null?(lang==='py'?'copy_input()':'copyInput()'):`output(${v[1]})`}`;}
await mkdir(new URL('../cookbook/',import.meta.url),{recursive:true});
for(const r of recipes)for(const lang of ['py','ts']){
 const sim=scenarios.get(Number(r.id.slice(0,2)));if(!sim)throw new Error(`Missing simulation for ${r.id}`);
 const deviceNote=r.entities.some(e=>e.kind==='Device')?'\n\nDevice declarations here are source-only placeholders. Devices and their wires are omitted from every export; add and connect them manually in Factorio.':'';
 const doc=`${r.title}\n\n${r.description}${deviceNote}\n\nSimulation (${sim.ticks} ticks): ${sim.note}\nRun builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.\nSource topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#${r.section}\nOriginal CircuitMaker implementation and explanation; parameters are editable in a copy.`;
 const imports=[...new Set(r.entities.map(e=>e.kind))];
 if(r.entities.some(e=>e.kind==='Arithmetic'))imports.push('Operation');
 imports.push('Simulation');
 if(sim.drivers.length)imports.push('Driver');
 if(r.wires.length||sim.drivers.length)imports.push('wire');
 usedCatalog=new Set();
 const lines=[];
 for(const e of r.entities){const fields=[['name',JSON.stringify(e.name)]];
  if(e.kind==='Decider')fields.push(['when',condition(e.condition,lang)],['outputs','['+e.outputs.map(o=>output(o,lang)).join(', ')+']']);
  if(e.kind==='Arithmetic')fields.push(['left',sig(e.left,lang)],['operation',`Operation.${operations[e.operation]}`],['right',sig(e.right,lang)],['output',sig(e.output,lang)]);
  if(e.kind==='Constant'){fields.push(['outputs','['+e.outputs.map(o=>output(o,lang)).join(', ')+']']);if(!e.enabled)fields.push(['enabled',lang==='py'?'False':'false']);}
  if(e.kind==='Device'){fields.push(['prototype',JSON.stringify(e.prototype)]);if(e.condition)fields.push(['when',condition(e.condition,lang)]);}
  lines.push(lang==='py'?`${e.id} = ${e.kind}(\n${fields.map(([k,v])=>`    ${k}=${v},`).join('\n')}\n)`:`const ${e.id} = new ${e.kind}({\n${fields.map(([k,v])=>`  ${k}: ${v},`).join('\n')}\n});`,'');
 }
 for(const driver of sim.drivers){
  lines.push(lang==='py'?`${driver.id} = Driver(${JSON.stringify(driver.id.replaceAll('_',' '))})`:`const ${driver.id} = new Driver({ name: ${JSON.stringify(driver.id.replaceAll('_',' '))} });`);
  for(const event of driver.events){
   const values='['+event.values.map(v=>output(v,lang)).join(', ')+']';
   const duration=event.duration===undefined?(lang==='py'?', reset_others=True':', true'):event.duration===1?'':lang==='py'?`, duration=${event.duration}`:`, ${event.duration}`;
   lines.push(`${driver.id}.${event.duration===undefined?'at':'pulse'}(${event.tick}, ${values}${duration})${lang==='ts'?';':''}`);
  }
  lines.push('');
 }
 for(const edge of [...r.wires,...sim.drivers.map(driver=>w(driver.id,driver.target,driver.color))]){
  const options=[];
  if(edge.color!=='red'){options.push([lang==='py'?'color':'color',`WireColor.${edge.color.toUpperCase()}`]);if(!imports.includes('WireColor'))imports.push('WireColor');}
  if(edge.sourcePort!=='output'){options.push([lang==='py'?'source_port':'sourcePort',`Port.${edge.sourcePort.toUpperCase()}`]);if(!imports.includes('Port'))imports.push('Port');}
  if(edge.targetPort!=='input'){options.push([lang==='py'?'target_port':'targetPort',`Port.${edge.targetPort.toUpperCase()}`]);if(!imports.includes('Port'))imports.push('Port');}
  const args=options.length?(lang==='py'?', '+options.map(([k,v])=>`${k}=${v}`).join(', '):`, { ${options.map(([k,v])=>`${k}: ${v}`).join(', ')} }`):'';
  lines.push(`wire(${edge.from}, ${edge.to}${args})${lang==='ts'?';':''}`);
 }
 const members=[...r.entities.filter(e=>e.kind!=='Device').map(e=>e.id),...sim.drivers.map(d=>d.id)].join(', ');
 lines.push('',lang==='py'?`scenario = Simulation([${members}], ticks=${sim.ticks}, name=${JSON.stringify(r.title)})`:`const scenario = new Simulation({ entities: [${members}], ticks: ${sim.ticks}, name: ${JSON.stringify(r.title)} });`);
 lines.push('',lang==='py'?'# Run checks these signal expectations automatically.':'// Run checks these signal expectations automatically.');
 const expectations=checks[Number(r.id.slice(0,2))];
 if(!expectations?.length)throw new Error(`Missing assertions for ${r.id}`);
 for(const [tick,number,signal,expected,color,port] of expectations){
  const entity=r.entities.filter(e=>e.kind!=='Device')[number-1];
  if(!entity||tick>sim.ticks)throw new Error(`Invalid assertion for ${r.id}`);
  const args=`${tick}, ${entity.id}, [${sig(signal,lang)}.output(${expected})]`;
  let options='';
  if(color){
   for(const name of ['WireColor','Port'])if(!imports.includes(name))imports.push(name);
   options=lang==='py'?`, color=WireColor.${color.toUpperCase()}, port=Port.${port.toUpperCase()}`:`, { color: WireColor.${color.toUpperCase()}, port: Port.${port.toUpperCase()} }`;
  }
  lines.push(`scenario.expect(${args}${options})${lang==='ts'?';':''}`);
 }
 const catalogImports=[...usedCatalog].sort().join(', ');
 const heading=lang==='py'?[`"""${doc}"""`,`from circuit import ${imports.join(', ')}`,`from catalog import ${catalogImports}`,'']:[`/**\n${doc.split('\n').map(l=>l?' * '+l:' *').join('\n')}\n */`,`import { ${imports.join(', ')} } from "circuit";`,`import { ${catalogImports} } from "catalog";`,''];
 lines.unshift(...heading);
 await writeFile(new URL(`../cookbook/${r.id}.${lang}`,import.meta.url),lines.join('\n')+'\n');
}
await writeFile(new URL('../cookbook/manifest.json',import.meta.url),JSON.stringify(recipes.map(({id,title,section})=>({id,title,section})),null,2)+'\n');
console.log(`Generated ${recipes.length} recipes in Python and TypeScript.`);
