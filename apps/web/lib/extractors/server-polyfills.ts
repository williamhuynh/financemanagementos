// pdfjs-dist (transitive dep of pdf-parse) expects the browser-only DOMMatrix
// API.  Polyfill it for Node.js / edge-server environments.  Only text
// extraction is used — no canvas rendering — so a minimal stub suffices.

// Pre-load the pdfjs worker module so that pdfjs-dist finds it on
// globalThis.pdfjsWorker.WorkerMessageHandler instead of dynamically
// importing pdf.worker.mjs at runtime.  The dynamic import inside pdfjs-dist
// uses /*webpackIgnore*/ which prevents bundlers (and Vercel's file tracer)
// from discovering the worker file, causing "Cannot find module" errors in
// production Lambdas.  This static import makes the file traceable AND
// supplies the handler directly so the dynamic import is never attempted.
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
(globalThis as Record<string, unknown>).pdfjsWorker = pdfjsWorker;

if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-expect-error -- intentionally incomplete stub
  globalThis.DOMMatrix = class DOMMatrix {
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    is2D = true;
    isIdentity = true;

    constructor(init?: number[] | string) {
      if (Array.isArray(init)) {
        const v = init;
        this.m11 = v[0] ?? 1; this.m12 = v[1] ?? 0;
        this.m13 = v[2] ?? 0; this.m14 = v[3] ?? 0;
        this.m21 = v[4] ?? 0; this.m22 = v[5] ?? 1;
        this.m23 = v[6] ?? 0; this.m24 = v[7] ?? 0;
        this.m31 = v[8] ?? 0; this.m32 = v[9] ?? 0;
        this.m33 = v[10] ?? 1; this.m34 = v[11] ?? 0;
        this.m41 = v[12] ?? 0; this.m42 = v[13] ?? 0;
        this.m43 = v[14] ?? 0; this.m44 = v[15] ?? 1;
        this.a = this.m11; this.b = this.m12;
        this.c = this.m21; this.d = this.m22;
        this.e = this.m41; this.f = this.m42;
      }
    }

    inverse() { return new DOMMatrix(); }
    multiply() { return new DOMMatrix(); }
    scale() { return new DOMMatrix(); }
    translate() { return new DOMMatrix(); }
    toString() { return "matrix(1,0,0,1,0,0)"; }
    static fromMatrix() { return new DOMMatrix(); }
    static fromFloat64Array(a: Float64Array) { return new DOMMatrix(Array.from(a)); }
    static fromFloat32Array(a: Float32Array) { return new DOMMatrix(Array.from(a)); }
  };
}
