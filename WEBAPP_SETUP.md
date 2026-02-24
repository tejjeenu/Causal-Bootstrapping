# Causal Risk Predictor Web App

## Backend (FastAPI)

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

Required backend artifacts:

- `neural_network_model.joblib`
- `backend/models/initial_eda_normalization_settings.json`

Required backend env variables (`backend/.env`):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_RESULTS_TABLE` (optional, default: `prediction_results`)
- `SUPABASE_RISK_SETTINGS_TABLE` (optional, default: `risk_classification_settings`)

Create both tables in Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.prediction_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clinical_inputs jsonb not null,
  risk_probability double precision not null,
  risk_percent double precision not null,
  risk_label text not null,
  uncertainty_std double precision not null,
  uncertainty_percent double precision not null,
  confidence_interval_95 jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.risk_classification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  threshold double precision not null check (threshold >= 0 and threshold <= 1),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, threshold)
);

alter table public.prediction_results enable row level security;
alter table public.risk_classification_settings enable row level security;

drop policy if exists "users can read own results" on public.prediction_results;
create policy "users can read own results"
on public.prediction_results
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own results" on public.prediction_results;
create policy "users can insert own results"
on public.prediction_results
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own results" on public.prediction_results;
create policy "users can update own results"
on public.prediction_results
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can read own risk settings" on public.risk_classification_settings;
create policy "users can read own risk settings"
on public.risk_classification_settings
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own risk settings" on public.risk_classification_settings;
create policy "users can insert own risk settings"
on public.risk_classification_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own risk settings" on public.risk_classification_settings;
create policy "users can update own risk settings"
on public.risk_classification_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own risk settings" on public.risk_classification_settings;
create policy "users can delete own risk settings"
on public.risk_classification_settings
for delete
using (auth.uid() = user_id);
```

## Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api/*` to the backend on port `8000`.

Auth behavior:

- Anyone can use prediction endpoints without login.
- Login/signup is only required for saving/loading personal prediction history and managing custom risk thresholds/labels.
