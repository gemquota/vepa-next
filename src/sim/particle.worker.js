import { createParticleExecutionAdapter } from './execution-adapter.js';

const PROTOCOL_VERSION = 1;

function response(id, payload, error) {
  return error
    ? { protocolVersion: PROTOCOL_VERSION, id, ok: false, error: { name: error.name ?? 'Error', message: error.message ?? String(error) } }
    : { protocolVersion: PROTOCOL_VERSION, id, ok: true, payload };
}

/** Attach the worker message protocol to a WorkerGlobalScope or test double. */
export function attachParticleWorker(scope) {
  if (!scope || typeof scope.addEventListener !== 'function' || typeof scope.postMessage !== 'function') throw new TypeError('scope must provide addEventListener() and postMessage()');
  let runtime = null;
  let disposed = false;

  function send(message, transfer = []) { scope.postMessage(message, transfer); }
  async function handle(event) {
    const message = event?.data;
    const id = message?.id;
    try {
      if (disposed) throw new Error('Worker runtime is disposed');
      if (!message || message.protocolVersion !== PROTOCOL_VERSION || !Number.isInteger(id) || id < 0 || typeof message.type !== 'string') throw new TypeError('Invalid worker message envelope');
      let payload;
      let transfer = [];
      switch (message.type) {
        case 'INIT':
          if (runtime) throw new Error('Worker runtime is already initialized');
          runtime = createParticleExecutionAdapter(message.payload ?? {});
          payload = { ready: true, tick: runtime.tick, count: runtime.count, stride: runtime.stride, config: runtime.getConfig() };
          break;
        case 'STEP':
          if (!runtime) throw new Error('Worker runtime is not initialized');
          payload = { metrics: runtime.step(), renderState: runtime.readRenderState() };
          transfer = [payload.renderState.buffer];
          break;
        case 'CONFIGURE':
          if (!runtime) throw new Error('Worker runtime is not initialized');
          payload = runtime.configure(message.payload ?? {});
          break;
        case 'READ_RENDER_STATE':
          if (!runtime) throw new Error('Worker runtime is not initialized');
          payload = runtime.readRenderState();
          transfer = [payload.buffer];
          break;
        case 'NEXT_RANDOM':
          if (!runtime) throw new Error('Worker runtime is not initialized');
          payload = runtime.nextRandom(message.payload?.domain, message.payload?.entityId);
          break;
        case 'GET_CONFIG':
          if (!runtime) throw new Error('Worker runtime is not initialized');
          payload = runtime.getConfig();
          break;
        case 'STATUS':
          if (!runtime) throw new Error('Worker runtime is not initialized');
          payload = { tick: runtime.tick, count: runtime.count, stride: runtime.stride };
          break;
        case 'READ_STATE':
          if (!runtime) throw new Error('Worker runtime is not initialized');
          payload = runtime.readState();
          transfer = [payload.buffer];
          break;
        case 'SNAPSHOT':
          if (!runtime) throw new Error('Worker runtime is not initialized');
          payload = runtime.createSnapshot();
          transfer = [payload.state.buffer];
          break;
        case 'RESTORE':
          if (!runtime) throw new Error('Worker runtime is not initialized');
          payload = runtime.restoreSnapshot(message.payload);
          break;
        case 'DISPOSE':
          runtime = null;
          disposed = true;
          payload = { disposed: true };
          break;
        default:
          throw new RangeError('Unknown worker command: ' + message.type);
      }
      send(response(id, payload), transfer);
    } catch (error) {
      send(response(Number.isInteger(id) && id >= 0 ? id : -1, null, error));
    }
  }

  scope.addEventListener('message', handle);
  return Object.freeze({ dispose() { disposed = true; runtime = null; } });
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function' && typeof self.postMessage === 'function') {
  attachParticleWorker(self);
}
