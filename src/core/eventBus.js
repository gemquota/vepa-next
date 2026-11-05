export class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, fn) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const list = this.listeners[event];
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
  }

  once(event, fn) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      fn(data);
    };
    return this.on(event, wrapper);
  }

  emit(event, data) {
    const list = this.listeners[event];
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      list[i](data);
    }
  }

  reset() {
    this.listeners = {};
  }
}

export const bus = new EventBus();
