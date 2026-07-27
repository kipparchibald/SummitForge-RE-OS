# CMA Export wiring

After Run CMA, the page should render:

```tsx
import ExportCmaButton from '@/components/cma/ExportCmaButton';

{result && <ExportCmaButton result={result} />}
```

Component lives at `components/cma/ExportCmaButton.tsx`.
Engine lives at `lib/cma/export.ts`.
