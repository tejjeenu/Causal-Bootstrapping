# CRUD API Guide (Spring Boot + Supabase)

Base URL (local): `http://localhost:8080`

This service owns:

- authentication session endpoints
- risk-rule CRUD
- prediction result CRUD against Supabase Postgres

## Run Locally

```powershell
cd spring-backend
mvn spring-boot:run
```

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Optional:

- `SUPABASE_RESULTS_TABLE` (default `prediction_results`)
- `SUPABASE_RISK_SETTINGS_TABLE` (default `risk_classification_settings`)
- `AUTH_COOKIE_NAME` (default `cb_auth_token`)
- `AUTH_COOKIE_SECURE` (default `false`)
- `AUTH_COOKIE_SAMESITE` (default `Lax`)
- `CORS_ORIGINS`
- `CRUD_API_PORT` (default `8080`)

## Main Endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /risk-settings`
- `PUT /risk-settings`
- `GET /results`
- `POST /results`
- `PATCH /results/{resultId}`

## Save Result Payload

`POST /results` expects model output from the ML API and persists it as-is:

```json
{
  "patient_first_name": "Ada",
  "patient_last_name": "Lovelace",
  "clinical_inputs": {
    "age": 58,
    "sex": "Male"
  },
  "risk_probability": 0.72,
  "risk_percent": 72.0,
  "risk_label": "High Risk",
  "uncertainty_std": 0.04,
  "uncertainty_percent": 4.0,
  "confidence_interval_95": [0.64, 0.80]
}
```

This keeps inference execution fully externalized to the ML API.
