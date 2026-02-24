# FastAPI Backend

## 1. Install dependencies

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

## 2. Configure Supabase auth

Set these keys in `backend\.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_RESULTS_TABLE` (optional, defaults to `prediction_results`)
- `SUPABASE_RISK_SETTINGS_TABLE` (optional, defaults to `risk_classification_settings`)

## 3. Create tables in Supabase SQL Editor

```sql
create extension if not exists pgcrypto;

create table if not exists public.prediction_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_first_name text not null,
  patient_last_name text not null,
  clinical_inputs jsonb not null,
  risk_probability double precision not null,
  risk_percent double precision not null,
  risk_label text not null,
  uncertainty_std double precision not null,
  uncertainty_percent double precision not null,
  confidence_interval_95 jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.prediction_results add column if not exists patient_first_name text;
alter table public.prediction_results add column if not exists patient_last_name text;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prediction_results'
      and column_name = 'first_name'
  ) then
    execute '
      update public.prediction_results
      set patient_first_name = coalesce(nullif(btrim(patient_first_name), ''''), nullif(btrim(first_name), ''''))
      where patient_first_name is null or btrim(patient_first_name) = ''''
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prediction_results'
      and column_name = 'last_name'
  ) then
    execute '
      update public.prediction_results
      set patient_last_name = coalesce(nullif(btrim(patient_last_name), ''''), nullif(btrim(last_name), ''''))
      where patient_last_name is null or btrim(patient_last_name) = ''''
    ';
  end if;
end $$;
update public.prediction_results set patient_first_name = 'Unknown' where patient_first_name is null or btrim(patient_first_name) = '';
update public.prediction_results set patient_last_name = 'Unknown' where patient_last_name is null or btrim(patient_last_name) = '';
alter table public.prediction_results alter column patient_first_name set not null;
alter table public.prediction_results alter column patient_last_name set not null;

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

## 4. Ensure model and normalization artifacts exist

```powershell
# expected model artifact (already present in this repo by default)
neural_network_model.joblib

# normalization settings exported from initial EDA
backend\models\initial_eda_normalization_settings.json
```

If the normalization JSON is missing, run the normalization export cell in
`initial EDA.ipynb` (the cell that applies `log1p` to `oldpeak` and `StandardScaler`).

You can also override paths with environment variables:

- `MODEL_ARTIFACT_PATH`
- `NORMALIZATION_SETTINGS_PATH`

## 5. Run the API

```powershell
uvicorn backend.app.main:app --reload --port 8000
```

## API endpoints

- `GET /health`
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /model-info` (public)
- `POST /predict` (public)
- `POST /results` (authenticated)
- `GET /results` (authenticated)
- `GET /risk-settings` (authenticated)
- `PUT /risk-settings` (authenticated)
