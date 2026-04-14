# Ascend

Minimal, execution-first workout tracker / training loop.

## Local dev

```bash
npm install
npm run dev
```

## Build (static deploy)

```bash
npm run build
```

This project uses `index.dev.html` as the source-of-truth. The build pipeline restores `index.html`, builds via Vite, then copies the built `index.html` + `assets/` into the project root (for simple static hosting).

## Tests (Playwright)

```bash
npm test
```
