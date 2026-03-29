// Hermes engine polyfills for missing globals

if (typeof WeakRef === 'undefined') {
  // @ts-expect-error -- minimal WeakRef polyfill for Hermes
  globalThis.WeakRef = class WeakRef<T extends object> {
    private _ref: T | undefined
    constructor(target: T) {
      this._ref = target
    }
    deref(): T | undefined {
      return this._ref
    }
  }
}
