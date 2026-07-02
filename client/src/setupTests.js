import '@testing-library/jest-dom';

// jsdom has no layout engine, so Recharts' ResponsiveContainer never gets a
// non-zero size without these two shims.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Element.prototype.getBoundingClientRect = () => ({
  width: 960, height: 320, top: 0, left: 0, right: 960, bottom: 320, x: 0, y: 0, toJSON() {},
});
