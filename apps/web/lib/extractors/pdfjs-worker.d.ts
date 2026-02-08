// Type declaration for the pdfjs-dist worker module which has no shipped types.
// Only the WorkerMessageHandler export is used (set on globalThis.pdfjsWorker).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
