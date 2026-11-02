function createMatrix(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
  const self = { a, b, c, d, e, f };

  self.multiply = (m) => createMatrix(
    self.a * m.a + self.c * m.b,
    self.b * m.a + self.d * m.b,
    self.a * m.c + self.c * m.d,
    self.b * m.c + self.d * m.d,
    self.a * m.e + self.c * m.f + self.e,
    self.b * m.e + self.d * m.f + self.f,
  );

  self.inverse = () => {
    const det = self.a * self.d - self.b * self.c;
    return createMatrix(
      self.d / det,
      -self.b / det,
      -self.c / det,
      self.a / det,
      (self.c * self.f - self.d * self.e) / det,
      (self.b * self.e - self.a * self.f) / det,
    );
  };

  self.translate = (x, y) => self.multiply(createMatrix(1, 0, 0, 1, x, y));
  self.scale = (s) => self.multiply(createMatrix(s, 0, 0, s, 0, 0));
  self.scaleNonUniform = (sx, sy) => self.multiply(createMatrix(sx, 0, 0, sy, 0, 0));
  self.rotate = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return self.multiply(createMatrix(Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0));
  };
  self.rotateFromVector = (x, y) => self.rotate((Math.atan2(y, x) * 180) / Math.PI);
  self.flipX = () => self.multiply(createMatrix(-1, 0, 0, 1, 0, 0));
  self.flipY = () => self.multiply(createMatrix(1, 0, 0, -1, 0, 0));
  self.skewX = (deg) => self.multiply(createMatrix(1, 0, Math.tan((deg * Math.PI) / 180), 1, 0, 0));
  self.skewY = (deg) => self.multiply(createMatrix(1, Math.tan((deg * Math.PI) / 180), 0, 1, 0, 0));

  return self;
}

if (typeof SVGElement !== 'undefined') {
  if (!SVGElement.prototype.getCTM) {
    SVGElement.prototype.getCTM = function getCTM() {
      return createMatrix();
    };
  }
  if (!SVGElement.prototype.getScreenCTM) {
    SVGElement.prototype.getScreenCTM = function getScreenCTM() {
      return createMatrix();
    };
  }
}

if (typeof SVGSVGElement !== 'undefined') {
  if (!SVGSVGElement.prototype.createSVGMatrix) {
    SVGSVGElement.prototype.createSVGMatrix = function createSVGMatrixPolyfill() {
      return createMatrix();
    };
  }
  if (!SVGSVGElement.prototype.createSVGPoint) {
    SVGSVGElement.prototype.createSVGPoint = function createSVGPointPolyfill() {
      return { x: 0, y: 0, matrixTransform(m) { return { x: m.a * this.x + m.c * this.y + m.e, y: m.b * this.x + m.d * this.y + m.f }; } };
    };
  }
  if (!SVGSVGElement.prototype.createSVGTransform) {
    SVGSVGElement.prototype.createSVGTransform = function createSVGTransformPolyfill() {
      return { setMatrix: () => {}, matrix: createMatrix() };
    };
  }
  if (!SVGSVGElement.prototype.createSVGTransformFromMatrix) {
    SVGSVGElement.prototype.createSVGTransformFromMatrix = function createSVGTransformFromMatrixPolyfill(matrix) {
      return { setMatrix: () => {}, matrix };
    };
  }
}

if (typeof SVGGraphicsElement !== 'undefined' && !SVGGraphicsElement.prototype.getBBox) {
  SVGGraphicsElement.prototype.getBBox = function getBBox() {
    return { x: 0, y: 0, width: 0, height: 0 };
  };
}

if (typeof HTMLCanvasElement !== 'undefined') {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(type: string, ...args: unknown[]) {
    if (type === '2d') {
      return {
        font: '',
        measureText: () => ({ width: 0 }),
        fillText: () => {},
        clearRect: () => {},
        fillRect: () => {},
        getImageData: () => ({ data: new Uint8Array(0) }),
      };
    }
    return origGetContext.call(this, type, ...args);
  } as any;
}
