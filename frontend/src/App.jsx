import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

const NUMERIC_FIELDS = [
  { key: 'age', label: 'Age', min: 1, max: 120, step: 1 },
  { key: 'trestbps', label: 'Resting Blood Pressure (mm Hg)', min: 50, max: 250, step: 1 },
  { key: 'chol', label: 'Serum Cholesterol (mg/dl)', min: 50, max: 700, step: 1 },
  { key: 'thalach', label: 'Maximum Heart Rate (beats per minute)', min: 120, max: 200, step: 1 },
  { key: 'oldpeak', label: 'Oldpeak', min: 0, max: 10, step: 0.1 },
  { key: 'ca', label: 'Number of Major Vessels', min: 0, max: 3, step: 1 },
]

const CATEGORICAL_FIELDS = [
  { key: 'sex', label: 'Sex', options: ['Female', 'Male'] },
  { key: 'cp', label: 'Chest Pain Type', options: ['Asymptomatic', 'Atypical Angina', 'NonAnginal Pain', 'Typical Angina'] },
  { key: 'fbs', label: 'Fasting Blood Sugar (mg/dl)', options: ['<=120', '>120'] },
  { key: 'restecg', label: 'Resting ECG', options: ['LV Hypertrophy', 'Normal ECG', 'ST-T Abnormality'] },
  { key: 'exang', label: 'Exercise Induced Angina', options: ['No Ex Angina', 'Yes Ex Angina'] },
  { key: 'slope', label: 'ST Slope', options: ['Downsloping', 'Flat', 'Upsloping'] },
  { key: 'thal', label: 'Thallium Stress Test', options: ['Fixed Defect', 'Normal', 'Reversible Defect'] },
]

const DEFAULT_FORM = {
  age: 58,
  trestbps: 132,
  chol: 224,
  thalach: 173,
  oldpeak: 3.2,
  ca: 2,
  sex: 'Male',
  cp: 'Asymptomatic',
  fbs: '<=120',
  restecg: 'Normal ECG',
  exang: 'Yes Ex Angina',
  slope: 'Flat',
  thal: 'Reversible Defect',
}

const DEFAULT_AUTH_FORM = { email: '', password: '' }
const DEFAULT_RULES = [
  { threshold: 0, label: 'Low Risk' },
  { threshold: 0.35, label: 'Medium Risk' },
  { threshold: 0.7, label: 'High Risk' },
]

function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [authPanelOpen, setAuthPanelOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(DEFAULT_AUTH_FORM)
  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const [formState, setFormState] = useState(DEFAULT_FORM)
  const [result, setResult] = useState(null)
  const [lastPredictionPayload, setLastPredictionPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [animatedRiskPercent, setAnimatedRiskPercent] = useState(0)
  const [animatedRiskProbability, setAnimatedRiskProbability] = useState(0)

  const [riskRules, setRiskRules] = useState(DEFAULT_RULES)
  const [riskSettingsLoading, setRiskSettingsLoading] = useState(false)
  const [riskSettingsSaving, setRiskSettingsSaving] = useState(false)
  const [riskSettingsError, setRiskSettingsError] = useState('')
  const [riskSettingsMessage, setRiskSettingsMessage] = useState('')

  const [savedResults, setSavedResults] = useState([])
  const [selectedRiskLabels, setSelectedRiskLabels] = useState([])
  const [riskFiltersTouched, setRiskFiltersTouched] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  const confidenceRange = useMemo(() => {
    if (!result?.confidence_interval_95) return null
    return result.confidence_interval_95.map((value) => `${(value * 100).toFixed(2)}%`)
  }, [result])

  useEffect(() => {
    if (!result) {
      setAnimatedRiskPercent(0)
      setAnimatedRiskProbability(0)
      return
    }

    const targetPercent = Number(result.risk_percent)
    const targetProbability = Number(result.risk_probability)
    const safePercent = Number.isFinite(targetPercent) ? targetPercent : 0
    const safeProbability = Number.isFinite(targetProbability) ? targetProbability : 0
    const durationMs = 950
    const startAt = performance.now()
    let frameId = 0

    const tick = (now) => {
      const progress = Math.min((now - startAt) / durationMs, 1)
      const eased = 1 - (1 - progress) ** 3
      setAnimatedRiskPercent(safePercent * eased)
      setAnimatedRiskProbability(safeProbability * eased)

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => {
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [result])

  const apiFetch = (path, options = {}) => {
    const shouldSetJsonHeader = options.body !== undefined
    return fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(shouldSetJsonHeader ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers ?? {}),
      },
    })
  }

  const normalizeRules = (rules) => {
    if (!Array.isArray(rules) || rules.length === 0) return DEFAULT_RULES
    const normalized = rules
      .map((rule) => ({ threshold: Number(rule?.threshold), label: String(rule?.label ?? '').trim() }))
      .filter((rule) => Number.isFinite(rule.threshold) && rule.label)
      .sort((a, b) => a.threshold - b.threshold)
    return normalized.length > 0 ? normalized : DEFAULT_RULES
  }

  const normalizeRiskLabel = (label) => {
    const normalized = String(label ?? '').trim()
    return normalized || 'Unlabeled'
  }

  const riskFilterOptions = useMemo(
    () => Array.from(new Set(savedResults.map((entry) => normalizeRiskLabel(entry?.risk_label)))),
    [savedResults],
  )

  const filteredSavedResults = useMemo(
    () => savedResults.filter((entry) => selectedRiskLabels.includes(normalizeRiskLabel(entry?.risk_label))),
    [savedResults, selectedRiskLabels],
  )

  const buildPredictionPayload = () =>
    Object.fromEntries(
      Object.entries(formState).map(([key, value]) => [
        key,
        typeof DEFAULT_FORM[key] === 'number' ? Number(value) : value,
      ]),
    )

  const loadSavedResults = async () => {
    if (!authUser) {
      setSavedResults([])
      return
    }
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const response = await apiFetch('/results')
      const body = await response.json()
      if (!response.ok) {
        setHistoryError(body?.detail || 'Unable to load saved results.')
        return
      }
      setSavedResults(Array.isArray(body?.results) ? body.results : [])
    } catch {
      setHistoryError('Unable to load saved results.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadRiskRules = async () => {
    if (!authUser) {
      setRiskRules(DEFAULT_RULES)
      return
    }
    setRiskSettingsLoading(true)
    setRiskSettingsError('')
    try {
      const response = await apiFetch('/risk-settings')
      const body = await response.json()
      if (!response.ok) {
        setRiskSettingsError(body?.detail || 'Unable to load risk rules.')
        return
      }
      setRiskRules(normalizeRules(body?.rules))
    } catch {
      setRiskSettingsError('Unable to load risk rules.')
    } finally {
      setRiskSettingsLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiFetch('/auth/me')
        if (response.ok) {
          const body = await response.json()
          setAuthUser(body?.authenticated ? body.user : null)
        } else {
          setAuthUser(null)
        }
      } catch {
        setAuthUser(null)
      } finally {
        setAuthChecked(true)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!authChecked || !authUser) {
      setRiskRules(DEFAULT_RULES)
      setSavedResults([])
      setSelectedRiskLabels([])
      setRiskFiltersTouched(false)
      return
    }
    loadRiskRules()
    loadSavedResults()
  }, [authChecked, authUser])

  useEffect(() => {
    setSelectedRiskLabels((previous) => {
      if (riskFilterOptions.length === 0) return []
      if (!riskFiltersTouched && previous.length === 0) return riskFilterOptions

      const remaining = previous.filter((label) => riskFilterOptions.includes(label))
      const additions = riskFilterOptions.filter((label) => !previous.includes(label))
      return [...remaining, ...additions]
    })
  }, [riskFilterOptions, riskFiltersTouched])

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthMessage('')
    setAuthLoading(true)
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/signup'
      const response = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(authForm) })
      const body = await response.json()
      if (!response.ok) {
        setAuthError(body?.detail || 'Authentication failed.')
        return
      }
      if (body?.authenticated && body?.user) {
        setAuthUser(body.user)
        setAuthForm(DEFAULT_AUTH_FORM)
        setAuthPanelOpen(false)
      } else {
        setAuthMode('login')
        setAuthMessage('Account created. Confirm your email, then sign in.')
      }
    } catch {
      setAuthError('Unable to connect to backend API.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } finally {
      setAuthUser(null)
      setSavedResults([])
      setSelectedRiskLabels([])
      setRiskFiltersTouched(false)
      setRiskRules(DEFAULT_RULES)
      setSaveError('')
      setSaveMessage('')
    }
  }

  const validateForm = () => {
    for (const field of NUMERIC_FIELDS) {
      const numericValue = Number(formState[field.key])
      if (!Number.isFinite(numericValue)) return `${field.label} must be a valid number.`
      if (numericValue < field.min || numericValue > field.max) {
        return `${field.label} must be between ${field.min} and ${field.max}.`
      }
      if (field.step === 1 && !Number.isInteger(numericValue)) return `${field.label} must be a whole number.`
    }
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSaveError('')
    setSaveMessage('')
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)
    const payload = buildPredictionPayload()
    try {
      const response = await apiFetch('/predict', { method: 'POST', body: JSON.stringify(payload) })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.detail || 'Prediction failed.')
        return
      }
      setResult(body)
      setLastPredictionPayload(payload)
    } catch {
      setError('Unable to connect to backend API. Make sure FastAPI is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveResult = async () => {
    setSaveError('')
    setSaveMessage('')
    if (!authUser) {
      setSaveError('Sign in first to save this result.')
      setAuthPanelOpen(true)
      return
    }
    if (!lastPredictionPayload) {
      setSaveError('Run prediction first.')
      return
    }
    setSaveLoading(true)
    try {
      const response = await apiFetch('/results', { method: 'POST', body: JSON.stringify(lastPredictionPayload) })
      const body = await response.json()
      if (!response.ok) {
        setSaveError(body?.detail || 'Unable to save result.')
        return
      }
      setSavedResults((previous) => [body, ...previous.filter((entry) => entry.id !== body.id)])
      setSaveMessage('Saved.')
    } catch {
      setSaveError('Unable to save result.')
    } finally {
      setSaveLoading(false)
    }
  }

  const updateRiskRule = (index, key, value) => {
    setRiskRules((previous) => {
      const copy = [...previous]
      copy[index] = { ...copy[index], [key]: value }
      return copy
    })
  }

  const addRiskRule = () => {
    const sorted = [...riskRules].sort((a, b) => Number(a.threshold) - Number(b.threshold))
    const nextThreshold = sorted.length > 0 ? Math.min(Number(sorted[sorted.length - 1].threshold) + 0.1, 1) : 0
    setRiskRules((previous) => [...previous, { threshold: Number(nextThreshold.toFixed(2)), label: 'Custom Risk' }])
  }

  const removeRiskRule = (index) => {
    setRiskRules((previous) => (previous.length <= 1 ? previous : previous.filter((_, i) => i !== index)))
  }

  const handleRiskSettingsSave = async (event) => {
    event.preventDefault()
    setRiskSettingsError('')
    setRiskSettingsMessage('')
    const normalized = riskRules.map((rule) => ({
      threshold: Number(rule.threshold),
      label: String(rule.label ?? '').trim(),
    }))
    if (normalized.length === 0) {
      setRiskSettingsError('Add at least one rule.')
      return
    }
    for (const rule of normalized) {
      if (!Number.isFinite(rule.threshold) || rule.threshold < 0 || rule.threshold > 1) {
        setRiskSettingsError('Thresholds must be between 0 and 1.')
        return
      }
      if (!rule.label) {
        setRiskSettingsError('Labels cannot be empty.')
        return
      }
    }
    const unique = new Set(normalized.map((rule) => rule.threshold.toFixed(10)))
    if (unique.size !== normalized.length) {
      setRiskSettingsError('Thresholds must be unique.')
      return
    }
    const sorted = [...normalized].sort((a, b) => a.threshold - b.threshold)
    setRiskSettingsSaving(true)
    try {
      const response = await apiFetch('/risk-settings', { method: 'PUT', body: JSON.stringify({ rules: sorted }) })
      const body = await response.json()
      if (!response.ok) {
        setRiskSettingsError(body?.detail || 'Unable to save risk rules.')
        return
      }
      setRiskRules(normalizeRules(body?.rules))
      setRiskSettingsMessage('Rules saved.')
    } catch {
      setRiskSettingsError('Unable to save risk rules.')
    } finally {
      setRiskSettingsSaving(false)
    }
  }

  const formatSavedDate = (isoDateTime) => {
    const parsed = new Date(isoDateTime)
    if (Number.isNaN(parsed.getTime())) return isoDateTime
    return parsed.toLocaleString()
  }

  const formatMetric = (value, digits = 2) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '-'
    return numeric.toFixed(digits)
  }

  const getClinicalInputValue = (entry, fieldKey) => {
    const value = entry?.clinical_inputs?.[fieldKey]
    if (value === null || value === undefined || value === '') return '-'
    return String(value)
  }

  const toCsvValue = (value) => {
    const raw = value === null || value === undefined ? '' : String(value)
    return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
  }

  const getRiskToneClass = (label) => {
    const lowered = String(label ?? '').toLowerCase()
    if (lowered.includes('high')) return 'high'
    if (lowered.includes('medium')) return 'medium'
    return 'low'
  }

  const toggleRiskLabelFilter = (label) => {
    setRiskFiltersTouched(true)
    setSelectedRiskLabels((previous) =>
      previous.includes(label) ? previous.filter((existing) => existing !== label) : [...previous, label],
    )
  }

  const selectAllRiskLabels = () => {
    setRiskFiltersTouched(true)
    setSelectedRiskLabels(riskFilterOptions)
  }

  const clearRiskLabels = () => {
    setRiskFiltersTouched(true)
    setSelectedRiskLabels([])
  }

  const exportFilteredResultsAsCsv = () => {
    if (filteredSavedResults.length === 0) return

    const headers = [
      'id',
      'created_at',
      'age',
      'sex',
      'cp',
      'trestbps',
      'chol',
      'thalach',
      'oldpeak',
      'ca',
      'risk_probability',
      'risk_percent',
      'risk_label',
    ]

    const rows = filteredSavedResults.map((entry) => {
      const clinical = entry?.clinical_inputs ?? {}
      return [
        entry?.id ?? '',
        entry?.created_at ?? '',
        clinical.age ?? '',
        clinical.sex ?? '',
        clinical.cp ?? '',
        clinical.trestbps ?? '',
        clinical.chol ?? '',
        clinical.thalach ?? '',
        clinical.oldpeak ?? '',
        clinical.ca ?? '',
        entry?.risk_probability ?? '',
        entry?.risk_percent ?? '',
        normalizeRiskLabel(entry?.risk_label),
      ]
    })

    const csv = [headers, ...rows].map((row) => row.map((value) => toCsvValue(value)).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    link.href = downloadUrl
    link.download = `saved_results_${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
  }

  const ruleSummary = useMemo(() => {
    if (!Array.isArray(result?.risk_rules)) return ''
    const sorted = [...result.risk_rules].sort((a, b) => Number(a.threshold) - Number(b.threshold))
    return sorted.map((rule) => `${(Number(rule.threshold) * 100).toFixed(1)}% -> ${rule.label}`).join(', ')
  }, [result])

  const liveAnnouncement = useMemo(() => {
    if (loading) return 'Calculating risk prediction.'
    if (saveLoading) return 'Saving prediction result.'
    if (riskSettingsSaving) return 'Saving risk classification rules.'
    if (historyLoading) return 'Loading saved results.'
    if (error) return `Prediction error. ${error}`
    if (authError) return `Authentication error. ${authError}`
    if (saveError) return `Save error. ${saveError}`
    if (riskSettingsError) return `Risk settings error. ${riskSettingsError}`
    if (saveMessage) return saveMessage
    if (riskSettingsMessage) return riskSettingsMessage
    if (result) return `Prediction complete. ${Number(result.risk_percent).toFixed(2)} percent risk, ${result.risk_label}.`
    return ''
  }, [
    loading,
    saveLoading,
    riskSettingsSaving,
    historyLoading,
    error,
    authError,
    saveError,
    riskSettingsError,
    saveMessage,
    riskSettingsMessage,
    result,
  ])

  return (
    <div className="page-shell">
      <a className="skip-link" href="#main-content">
        Skip to clinical input form
      </a>
      <p className="sr-only" role="status" aria-live="polite">
        {liveAnnouncement}
      </p>
      <header className="hero reveal">
        <div className="hero-top-row">
          <p className="eyebrow">Heart Disease Risk Prediction</p>
          {authUser ? (
            <button type="button" className="logout-button" onClick={handleLogout}>
              Log out
            </button>
          ) : (
            <button type="button" className="logout-button" onClick={() => setAuthPanelOpen((prev) => !prev)}>
              {authPanelOpen ? 'Hide Login' : 'Sign In / Sign Up'}
            </button>
          )}
        </div>
        <h1>Causal Risk Predictor - Coronary Artery Disease</h1>
        <p className="subtitle">Guest users can predict. Sign in to save history and configure risk labels.</p>
      </header>

      {!authUser && authPanelOpen && (
        <section className="panel auth-inline-panel reveal delay-1" aria-live="polite">
          <h2>{authMode === 'login' ? 'Sign in to save results' : 'Create account to save results'}</h2>
          <form className="auth-inline-form" onSubmit={handleAuthSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                autoComplete="email"
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
            </label>
            <button type="submit" disabled={authLoading}>
              {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          {authError && <p className="error" role="alert">{authError}</p>}
          {authMessage && <p className="auth-message-inline">{authMessage}</p>}
          <button
            type="button"
            className="auth-inline-toggle"
            onClick={() => setAuthMode((prev) => (prev === 'login' ? 'signup' : 'login'))}
          >
            {authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </section>
      )}

      {authUser && (
        <section className="panel risk-settings-panel reveal delay-1" aria-busy={riskSettingsLoading || riskSettingsSaving}>
          <h2>Custom Risk Classification</h2>
          <p className="auth-inline-copy">Highest crossed threshold determines the label.</p>
          <form className="risk-settings-form" onSubmit={handleRiskSettingsSave}>
            {riskRules.map((rule, index) => (
              <div key={`rule-${index}`} className="risk-rule-row">
                <label className="field">
                  <span>Threshold</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={rule.threshold}
                    onChange={(event) => updateRiskRule(index, 'threshold', event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Label</span>
                  <input
                    type="text"
                    maxLength={60}
                    value={rule.label}
                    onChange={(event) => updateRiskRule(index, 'label', event.target.value)}
                    required
                  />
                </label>
                <button type="button" className="remove-rule-button" onClick={() => removeRiskRule(index)}>
                  Remove
                </button>
              </div>
            ))}
            <div className="risk-rule-actions">
              <button type="button" className="add-rule-button" onClick={addRiskRule}>
                Add Rule
              </button>
              <button type="submit" disabled={riskSettingsSaving || riskSettingsLoading}>
                {riskSettingsSaving ? 'Saving...' : 'Save Rules'}
              </button>
            </div>
          </form>
          {riskSettingsError && <p className="error" role="alert">{riskSettingsError}</p>}
          {riskSettingsMessage && <p className="save-message">{riskSettingsMessage}</p>}
        </section>
      )}

      <main className="layout" id="main-content">
        <section className="panel reveal delay-2" aria-busy={loading}>
          <h2>Clinical Inputs</h2>
          <form onSubmit={handleSubmit} className="prediction-form">
            <div className="field-grid">
              {NUMERIC_FIELDS.map((field) => (
                <label key={field.key} className="field">
                  <span>{field.label}</span>
                  <input
                    type="number"
                    value={formState[field.key]}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    onChange={(event) => setFormState((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    required
                  />
                </label>
              ))}
              {CATEGORICAL_FIELDS.map((field) => (
                <label key={field.key} className="field field-select">
                  <span>{field.label}</span>
                  <select
                    id={`input-${field.key}`}
                    value={formState[field.key]}
                    onChange={(event) => setFormState((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  >
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Calculating...' : 'Predict Risk'}
            </button>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        <aside className="panel result-panel reveal delay-3" aria-live="polite" aria-busy={loading}>
          <h2>Prediction Result</h2>
          {loading ? (
            <div className="predicting-card" role="status" aria-live="polite">
              <div className="predicting-header">
                <span className="predict-dot" />
                <p>Running risk inference...</p>
              </div>
              <div className="predict-track">
                <span />
              </div>
              <p className="predicting-subtext">Calculating probability and uncertainty bounds.</p>
            </div>
          ) : result ? (
            <div className="result-content result-content-animate">
              <p className={`risk-label ${getRiskToneClass(result.risk_label)}`}>{result.risk_label}</p>
              <p className="risk-percent">{animatedRiskPercent.toFixed(2)}%</p>
              <div className="risk-meter">
                <span style={{ width: `${Math.max(0, Math.min(animatedRiskPercent, 100))}%` }} />
              </div>
              <p className="metric">Probability: {animatedRiskProbability.toFixed(4)}</p>
              <p className="metric">Uncertainty: {Number(result.uncertainty_percent).toFixed(2)}%</p>
              <p className="metric">95% interval: {confidenceRange?.[0]} - {confidenceRange?.[1]}</p>
              {ruleSummary && <p className="metric">Rules: {ruleSummary}</p>}
              <div className="divider" />
              {authUser ? (
                <button type="button" className="save-result-button" onClick={handleSaveResult} disabled={saveLoading}>
                  {saveLoading ? 'Saving...' : 'Save This Result'}
                </button>
              ) : (
                <p className="metric login-hint">Sign in to save this result and access your own history.</p>
              )}
              {saveError && <p className="error" role="alert">{saveError}</p>}
              {saveMessage && <p className="save-message">{saveMessage}</p>}
            </div>
          ) : (
            <p className="placeholder">Submit the form to see prediction output.</p>
          )}
        </aside>
      </main>

      {authUser && (
        <section className="panel saved-results-panel reveal delay-4" aria-busy={historyLoading}>
          <div className="saved-results-head">
            <h2>My Saved Results</h2>
            <button type="button" className="refresh-history-button" onClick={loadSavedResults}>
              Refresh
            </button>
          </div>
          {historyLoading && <p className="placeholder">Loading...</p>}
          {historyError && <p className="error" role="alert">{historyError}</p>}
          {!historyLoading && !historyError && savedResults.length === 0 && <p className="placeholder">No saved results yet.</p>}
          {!historyLoading && savedResults.length > 0 && (
            <>
              <div className="saved-results-toolbar">
                <fieldset className="risk-filter-group">
                  <legend className="risk-filter-title">Show risk classifications</legend>
                  <div className="risk-filter-options">
                    {riskFilterOptions.map((label) => (
                      <label key={label} className="risk-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedRiskLabels.includes(label)}
                          onChange={() => toggleRiskLabelFilter(label)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="saved-results-actions">
                  <button
                    type="button"
                    className="refresh-history-button"
                    onClick={selectAllRiskLabels}
                    disabled={riskFilterOptions.length === selectedRiskLabels.length}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="refresh-history-button"
                    onClick={clearRiskLabels}
                    disabled={selectedRiskLabels.length === 0}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="export-history-button"
                    onClick={exportFilteredResultsAsCsv}
                    disabled={filteredSavedResults.length === 0}
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              {filteredSavedResults.length === 0 ? (
                <p className="placeholder">No rows match the selected classifications.</p>
              ) : (
                <div className="saved-results-table-shell">
                  <table className="saved-results-table">
                    <caption className="sr-only">
                      Saved prediction results with clinical inputs, numerical risk, and classification.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Age</th>
                        <th scope="col">Sex</th>
                        <th scope="col">Chest Pain</th>
                        <th scope="col">Resting BP</th>
                        <th scope="col">Cholesterol</th>
                        <th scope="col">Max HR</th>
                        <th scope="col">Oldpeak</th>
                        <th scope="col">Vessels (CA)</th>
                        <th scope="col">Risk %</th>
                        <th scope="col">Risk Probability</th>
                        <th scope="col">Classification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSavedResults.map((entry) => {
                        const riskLabel = normalizeRiskLabel(entry?.risk_label)
                        return (
                          <tr key={entry.id}>
                            <td>{formatSavedDate(entry.created_at)}</td>
                            <td>{getClinicalInputValue(entry, 'age')}</td>
                            <td>{getClinicalInputValue(entry, 'sex')}</td>
                            <td>{getClinicalInputValue(entry, 'cp')}</td>
                            <td>{getClinicalInputValue(entry, 'trestbps')}</td>
                            <td>{getClinicalInputValue(entry, 'chol')}</td>
                            <td>{getClinicalInputValue(entry, 'thalach')}</td>
                            <td>{getClinicalInputValue(entry, 'oldpeak')}</td>
                            <td>{getClinicalInputValue(entry, 'ca')}</td>
                            <td>{formatMetric(entry.risk_percent)}%</td>
                            <td>{formatMetric(entry.risk_probability, 4)}</td>
                            <td>
                              <span className={`saved-risk-chip ${getRiskToneClass(riskLabel)}`}>{riskLabel}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

    </div>
  )
}

export default App
