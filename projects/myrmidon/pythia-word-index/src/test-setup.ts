// The library test build does not include the @angular/localize polyfill
// (unlike the app), so initialize it here for any $localize usage.
import '@angular/localize/init';

// jsdom lacks ResizeObserver, used by echarts charts
if (!('ResizeObserver' in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
