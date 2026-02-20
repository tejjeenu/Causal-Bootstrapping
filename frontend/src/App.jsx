import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

const NUMERIC_FIELDS = [
  { key: 'age', label: 'Age', min: 1, max: 120, step: 1 },
  { key: 'trestbps', label: 'Resting BP', min: 50, max: 250, step: 1 },
  { key: 'chol', label: 'Cholesterol', min: 50, max: 700, step: 1 },
  { key: 'thalach', label: 'Max HR', min: 50, max: 250, step: 1 },
  { key: 'oldpeak', label: 'Oldpeak', min: 0, max: 10, step: 0.1 },
  { key: 'ca', label: 'Major Vessels (ca)', min: 0, max: 4, step: 1 },
]

const CATEGORICAL_FIELDS = [
  { key: 'sex', label: 'Sex', options: ['Female', 'Male'] },
  {
    key: 'cp',
    label: 'Chest Pain',
    options: ['Asymptomatic', 'AtypicalAngina', 'NonAnginalPain', 'TypicalAngina'],
  },
  { key: 'fbs', label: 'Fasting Blood Sugar', options: ['<=120', '>120'] },
  {
    key: 'restecg',
    label: 'Resting ECG',
    options: ['LVHypertrophy', 'NormalECG', 'STTAbnormality'],
  },
  { key: 'exang', label: 'Exercise Angina', options: ['NoExAngina', 'YesExAngina'] },
  { key: 'slope', label: 'ST Slope', options: ['Downsloping', 'Flat', 'Upsloping'] },
  { key: 'thal', label: 'Thal', options: ['FixedDefect', 'Normal', 'ReversibleDefect'] },
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
  restecg: 'NormalECG',
  exang: 'YesExAngina',
  slope: 'Flat',
  thal: 'ReversibleDefect',
}

function CustomDropdown({ id, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div className="custom-select" ref={rootRef}>
      <button
        type="button"
        className={`custom-select-trigger ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`listbox-${id}`}
        onClick={() => setOpen((previous) => !previous)}
      >
        {value}
      </button>
      {open && (
        <ul id={`listbox-${id}`} className="custom-options" role="listbox">
          {options.map((option) => (
            <li key={option} role="option" aria-selected={option === value}>
              <button
                type="button"
                className={`custom-option ${option === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function App() {
  const [formState, setFormState] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [modelInfo, setModelInfo] = useState(null)

  const confidenceRange = useMemo(() => {
    if (!result?.confidence_interval_95) return null
    return result.confidence_interval_95.map((value) => `${(value * 100).toFixed(2)}%`)
  }, [result])

  useEffect(() => {
    const loadModelInfo = async () => {
      try {
        const response = await fetch(`${API_BASE}/model-info`)
        if (!response.ok) return
        const payload = await response.json()
        setModelInfo(payload)
      } catch {
        setModelInfo(null)
      }
    }

    loadModelInfo()
  }, [])

  const updateValue = (key, value) => {
    setFormState((previous) => ({ ...previous, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    const payload = Object.fromEntries(
      Object.entries(formState).map(([key, value]) => [
        key,
        typeof DEFAULT_FORM[key] === 'number' ? Number(value) : value,
      ]),
    )

    try {
      const response = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.detail || 'Prediction failed.')
        return
      }

      setResult(body)
    } catch {
      setError('Unable to connect to backend API. Make sure FastAPI is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell">
      <header className="hero reveal">
        <p className="eyebrow">Heart Disease Risk Prediction</p>
        <h1>Causal Risk Predictor - Coronary Artery Disease</h1>
        <p className="subtitle">
          This application demonstrates a coronary artery disease risk predictor trained on
          data which removes potential confounding signals for more reliable predictions. Enter clinical data to see predicted risk and uncertainty.
        </p>
      </header>

      <section className="causal-graph-card reveal delay-1">
        <div>
          <h2>Causal Graph Signal</h2>
          <p>
            Age and Sex both affect remaining clinical inputs and heart disease presence, matching
            your DAG structure.
          </p>
        </div>
        <svg className="causal-graph" viewBox="0 0 560 220" role="img" aria-label="Causal graph">
          <path className="edge" d="M120 82 C120 105 120 125 120 146" />
          <path className="edge" d="M440 82 C440 105 440 125 440 146" />
          <path className="edge" d="M142 80 C230 98 320 128 412 146" />
          <path className="edge" d="M418 80 C330 98 240 128 148 146" />
          <path className="edge edge-feedback" d="M410 168 C330 168 250 168 170 168" />

          <circle className="node source" cx="120" cy="52" r="40" />
          <circle className="node source" cx="440" cy="52" r="40" />
          <circle className="node target" cx="120" cy="170" r="40" />
          <circle className="node source" cx="440" cy="170" r="40" />

          <text x="120" y="56" textAnchor="middle">
            Sex
          </text>
          <text x="440" y="56" textAnchor="middle">
            Age
          </text>
          <text x="120" y="172" textAnchor="middle">
            <tspan x="120" dy="0">Clinical Inputs</tspan>
          </text>
          <text x="440" y="172" textAnchor="middle">
            <tspan x="440" dy="0">Heart Disease</tspan>
          </text>

          <path className="flow-arrow" d="M0 0 L-9 -4.5 L-9 4.5 Z">
            <animateMotion
              dur="3s"
              repeatCount="indefinite"
              rotate="auto"
              path="M120 82 C120 105 120 125 120 146"
            />
          </path>
          <path className="flow-arrow" d="M0 0 L-9 -4.5 L-9 4.5 Z">
            <animateMotion
              dur="3s"
              repeatCount="indefinite"
              rotate="auto"
              path="M440 82 C440 105 440 125 440 146"
            />
          </path>
          <path className="flow-arrow" d="M0 0 L-9 -4.5 L-9 4.5 Z">
            <animateMotion
              dur="3s"
              repeatCount="indefinite"
              rotate="auto"
              path="M142 80 C230 98 320 128 412 146"
            />
          </path>
          <path className="flow-arrow" d="M0 0 L-9 -4.5 L-9 4.5 Z">
            <animateMotion
              dur="3s"
              repeatCount="indefinite"
              rotate="auto"
              path="M418 80 C330 98 240 128 148 146"
            />
          </path>
          <path className="flow-arrow" d="M0 0 L-9 -4.5 L-9 4.5 Z">
            <animateMotion
              dur="3s"
              repeatCount="indefinite"
              rotate="auto"
              path="M410 168 C330 168 250 168 170 168"
            />
          </path>

        </svg>
      </section>

      <main className="layout">
        <section className="panel reveal delay-2">
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
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    required
                  />
                </label>
              ))}

              {CATEGORICAL_FIELDS.map((field) => (
                <label key={field.key} className="field field-select">
                  <span>{field.label}</span>
                  <CustomDropdown
                    id={field.key}
                    value={formState[field.key]}
                    options={field.options}
                    onChange={(nextValue) => updateValue(field.key, nextValue)}
                  />
                </label>
              ))}
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Calculating...' : 'Predict Risk'}
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </section>

        <aside className="panel result-panel reveal delay-3">
          <h2>Prediction Result</h2>
          {!result && <p className="placeholder">Submit the form to see risk and uncertainty.</p>}

          {result && (
            <div className="result-content">
              <p className={`risk-label ${result.risk_label === 'High Risk' ? 'high' : 'low'}`}>
                {result.risk_label}
              </p>
              <p className="risk-percent">{result.risk_percent}%</p>
              <p className="metric">Uncertainty (std dev): {result.uncertainty_percent}%</p>
              <p className="metric">
                95% interval: {confidenceRange?.[0]} - {confidenceRange?.[1]}
              </p>
              <div className="divider" />
              <p className="model-meta">Model: {result.model_name}</p>
              <p className="model-meta">Training source: {result.training_source}</p>
            </div>
          )}
        </aside>
      </main>

      <footer className="meta-bar reveal delay-4">
        <div>
          <span>Selected model</span>
          <strong>{modelInfo?.model_name ?? 'Unavailable'}</strong>
        </div>
        <div>
          <span>Accuracy on confounded holdout</span>
          <strong>
            {modelInfo?.selection_metrics?.accuracy
              ? `${(modelInfo.selection_metrics.accuracy * 100).toFixed(2)}%`
              : 'Unavailable'}
          </strong>
        </div>
        <div>
          <span>Bootstrap models</span>
          <strong>{modelInfo?.bootstrap_count ?? 0}</strong>
        </div>
      </footer>
    </div>
  )
}

export default App
