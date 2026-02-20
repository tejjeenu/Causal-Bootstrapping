# React + Vite Frontend

## Install

```powershell
cd frontend
npm install
```

## Run in development

```powershell
npm run dev
```

By default, requests to `/api/*` are proxied to `http://localhost:8000/*`.

If needed, override API base directly:

```powershell
$env:VITE_API_BASE_URL="http://localhost:8000"
npm run dev
```

## Build

```powershell
npm run build
```

