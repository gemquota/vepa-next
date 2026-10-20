import { createParticleExecutionAdapter } from './execution-adapter.js';

const PROTOCOL_VERSION = 1;

function createLocalAdapter(options) {
 const runtime = createParticleExecutionAdapter(options);
 return Object.freeze({
  mode: 'in-process',
  get tick() { return runtime.tick; },
  get count() { return runtime.count; },
  get stride() { return runtime.stride; },
  getConfig: () => runtime.getConfig(),
  readState: () => runtime.readState(),
  configure: async config => runtime.configure(config),
  step: async () => ({ metrics: runtime.step(), state: runtime.readState() }),
  createSnapshot: async () => runtime.createSnapshot(),
  restoreSnapshot: async snapshot => runtime.restoreSnapshot(snapshot),
  dispose: async () => ({ disposed: true }),
 });
}

/** Async worker facade. If Workers are unavailable, use the same execution contract in-process. */
export async function createWorkerExecutionAdapter({ workerFactory, fallbackFactory = createParticleExecutionAdapter, ...options } = {}) {
 let worker;
 try {
  if (workerFactory) worker = workerFactory();
  else if (typeof Worker === 'function') worker = new Worker(new URL('./particle.worker.js', import.meta.url), { type: 'module' });
 } catch {
  worker = null;
 }
 if (!worker) return createLocalAdapter({ ...options, initialState: options.initialState });
 if (typeof worker.addEventListener !== 'function' || typeof worker.postMessage !== 'function') {
  worker.terminate?.();
  throw new TypeError('workerFactory must return a Worker-like object');
 }

 let nextId = 0;
 let disposed = false;
 const pending = new Map();
 function rejectPending(error) {
  for (const entry of pending.values()) entry.reject(error);
  pending.clear();
 }
 worker.addEventListener('message', event => {
  const message = event?.data;
  const entry = pending.get(message?.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.protocolVersion !== PROTOCOL_VERSION || message.ok !== true) {
   const error = new Error(message?.error?.message ?? 'Invalid worker response');
   error.name = message?.error?.name ?? 'Error';
   entry.reject(error);
  } else entry.resolve(message.payload);
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
 let lastConfig = { ...(options.config ?? {}) };
 return Object.freeze({
  mode: 'worker',
  get count() { return options.count ?? options.initialState.length / (options.stride ?? 100); },
  get stride() { return options.stride ?? 100; },
  get tick() { return undefined; },
  getConfig: async () => { return { ...lastConfig, ...(await request('CONFIGURE', {}) .catch(() => ({}))) }; },
  readState: async () => { const result = await request('STEP', { readOnly: true }); return new result.state.constructor(result.state); },
  configure: async config => { lastConfig = { ...lastConfig, ...config }; return request('CONFIGURE', config); },
  step: async () => request('STEP'),
  createSnapshot: async () => request('SNAPSHOT'),
  restoreSnapshot: async snapshot => {
   const copy = { ...snapshot, state: new snapshot.state.constructor(snapshot.state) };
   return request('RESTORE', copy, [copy.state.buffer]);
  },
  async dispose() {
   if (disposed) return { disposed: true };
   try { await request('DISPOSE'); } finally { disposed = true; rejectPending(new Error('Worker adapter disposed')); worker.terminate?.(); }
   return { disposed: true };
  },
 });
}
