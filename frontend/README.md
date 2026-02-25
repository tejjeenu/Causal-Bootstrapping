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

By default:

- requests to `/ml-api/*` are proxied to `http://localhost:8000/*` (FastAPI ML API)
- requests to `/crud-api/*` are proxied to `http://localhost:8080/*` (Spring CRUD API)

If needed, override API bases directly:

```powershell
$env:VITE_ML_API_BASE_URL="http://localhost:8000"
$env:VITE_CRUD_API_BASE_URL="http://localhost:8080"
npm run dev
```

## Build

```powershell
npm run build
```
