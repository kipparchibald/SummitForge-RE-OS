// Next ships declarations for `*.module.css` only. TypeScript 6 errors on
// side-effect imports of untyped modules, so plain global stylesheet imports
// (e.g. `import './globals.css'` in app/layout.tsx) need this declaration.
declare module '*.css';
