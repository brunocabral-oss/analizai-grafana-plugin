// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

// Robust canvas measureText mock for @grafana/ui Combobox / useComboboxFloat
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (contextId) {
    if (contextId === '2d') {
      return {
        measureText: (text) => ({
          width: (text ? text.length : 0) * 8,
          actualBoundingBoxAscent: 10,
          actualBoundingBoxDescent: 2,
        }),
        font: '',
      };
    }
    return null;
  };
}
