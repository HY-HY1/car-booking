// `import text from "./file.ts?raw"`: the file's source as a string, through
// the "?raw" rule in next.config.ts.
declare module "*?raw" {
  const source: string;
  export default source;
}
