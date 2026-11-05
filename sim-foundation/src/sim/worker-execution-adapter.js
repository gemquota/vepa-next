import { createParticleExecutionAdapter } from './execution-adapter.js';

const PROTOCOL_VERSION = 1;

function localFacade(runtime) {
 return Object.freeze({
  mode: 'in-process',
  get count() { return runtime.count; },
  get stride() { return runtime.stride; },
  get tick() { return runtime.tick; },
  getConfig: async () => runtime.getConfig(),
  nextRandom: async (domain, entityId) => runtime.nextRandom(domain, entityId),
  getParticleIdentity: async slot => runtime.getParticleIdentity(slot),
  allocateParticle: async (slot, values) => runtime.allocateParticle(slot, values),
  retireParticle: async slot => runtime.retireParticle(slot),
  getStatus: async () => ({ tick: runtime.tick, count: runtime.count, stride: runtime.stride }),
  readState: async () => runtime.readState(),
  readRenderState: async () => runtime.readRenderState(),
  configure: async config => runtime.configure(config),
  step: async () => ({ metrics: runtime.step(), renderState: runtime.readRenderState() }),
  createSnapshot: async () => runtime.createSnapshot(),
  restoreSnapshot: async snapshot => runtime.restoreSnapshot(snapshot),
  dispose: async () => ({ disposed: true }),
 });
}

/** Async worker facade. It falls back in-process only when Worker construction is unavailable. */
export async function createWorkerExecutionAdapter({ workerFactory, fallbackFactory = createParticleExecutionAdapter, ...options } = {}) {
 let worker = null;
 try {
  if (workerFactory) worker = workerFactory();
  else if (typeof Worker === 'function') worker = new Worker(new URL('./particle.worker.js', import.meta.url), { type: 'module' });
 } catch { worker = null; }
 if (!worker) return localFacade(fallbackFactory(options));
 if (typeof worker.addEventListener !== 'function' || typeof worker.postMessage !== 'function') {
  worker.terminate?.();
  throw new TypeError('workerFactory must return a Worker-like object');
 }

 let nextId = 0;
 let disposed = false;
 const pending = new Map();
 function rejectPending(error) { for (const item of pending.values()) item.reject(error); pending.clear(); }
 worker.addEventListener('message', event => {
  const message = event?.data;
  const item = pending.get(message?.id);
  if (!item) return;
  pending.delete(message.id);
  if (message.protocolVersion !== PROTOCOL_VERSION || message.ok !== true) {
   const error = new Error(message?.error?.message ?? 'Invalid worker response');
   error.name = message?.error?.name ?? 'Error';
   item.reject(error);
  } else item.resolve(message.payload);
 });
 worker.addEventListener('error', event => rejectPending(new Error(event?.message ?? 'Particle worker failed')));
 worker.addEventListener('messageerror', () => rejectPending(new Error('Particle worker message could not be decoded')));

 function request(type, payload, transfer = []) {
  if (disposed) return Promise.reject(new Error('Worker adapter is disposed'));
  const id = nextId++;
  return new Promise((resolve, reject) => {
   pending.set(id, { resolve, reject });
   try { worker.postMessage({ protocolVersion: PROTOCOL_VERSION, id, type, payload }, transfer); }
   catch (error) { pending.delete(id); reject(error); }
  });
 }
 const initState = new options.initialState.constructor(options.initialState);
 await request('INIT', { ...options, initialState: initState }, [initState.buffer]);
 return Object.freeze({
  mode: 'worker',
  get count() { return options.count ?? options.initialState.length / (options.stride ?? 100); },
  get stride() { return options.stride ?? 100; },
  get tick() { return undefined; },
  getConfig: () => request('GET_CONFIG'),
  nextRandom: (domain, entityId) => request('NEXT_RANDOM', { domain, entityId }),
  getParticleIdentity: slot => request('GET_PARTICLE_IDENTITY', { slot }),
  allocateParticle: (slot, values) => request('ALLOCATE_PARTICLE', { slot, values: Array.from(values) }),
  retireParticle: slot => request('RETIRE_PARTICLE', { slot }),
  getStatus: () => request('STATUS'),
  readState: async () => request('READ_STATE'),
  readRenderState: () => request('READ_RENDER_STATE'),
  configure: config => request('CONFIGURE', config),
  step: () => request('STEP'),
  createSnapshot: () => request('SNAPSHOT'),
  restoreSnapshot(snapshot) {
   const copy = { ...snapshot, state: new snapshot.state.constructor(snapshot.state) };
   return request('RESTORE', copy, [copy.state.buffer]);
  },
  async dispose() {
   if (disposed) return { disposed: true };
   try { return await request('DISPOSE'); }
   finally { disposed = true; rejectPending(new Error('Worker adapter disposed')); worker.terminate?.(); }
  },
 });
}
