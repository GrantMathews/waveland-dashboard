import { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const THRESHOLDS = {
  temperature: { min: 32, max: 95, warn_min: 59, warn_max: 86, unit: '°F' },
  salinity:    { min: 0,  max: 40, warn_min: 15, warn_max: 35, unit: 'ppt' },
  do:          { min: 0,  max: 15, warn_min: 3.2, warn_max: 15, unit: 'mg/L' }
}

const SENSOR_COLORS = { temperature: '#E8622A', salinity: '#3B9EE8', do: '#4CAF7D' }
const SENSOR_LABELS = { temperature: 'Temperature (°F)', salinity: 'Salinity (ppt)', do: 'Dissolved O₂ (mg/L)' }
const SENSOR_UNITS  = { temperature: '°F', salinity: 'ppt', do: 'mg/L' }

function getStatus(sensor, value) {
  const t = THRESHOLDS[sensor]
  if (!t || value === null) return { color: '#888', label: 'no data' }
  if (value < t.warn_min || value > t.warn_max) return { color: '#E24B4A', label: 'out of range' }
  return { color: '#4CAF7D', label: 'optimal' }
}

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function App() {
  const [readings, setReadings] = useState([])
  const [sensor, setSensor] = useState('temperature')
  const [range, setRange] = useState(168)
  const [lastUpdated, setLastUpdated] = useState('')
  const [error, setError] = useState(null)

  async function loadData() {
    const since = new Date(Date.now() - range * 3600 * 1000).toISOString()
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/readings?recorded_at=gte.${encodeURIComponent(since)}&order=recorded_at.asc&limit=2000`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } }
      )
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      setReadings(data)
      setError(null)
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { loadData() }, [range])
  useEffect(() => {
    const id = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [range])

  const latest = (s) => {
    const sr = readings.filter(r => r.sensor_type === s)
    return sr.length ? parseFloat(sr[sr.length - 1].value) : null
  }

  const barPct = (s, val) => {
    const t = THRESHOLDS[s]
    if (!t || val === null) return 0
    return Math.min(100, Math.max(0, ((val - t.min) / (t.max - t.min)) * 100))
  }

  const chartData = () => {
    const filtered = readings
      .filter(r => r.sensor_type === sensor)
      .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
    const color = SENSOR_COLORS[sensor]
    return {
      labels: filtered.map(r => {
        const d = new Date(r.recorded_at)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
               d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      }),
      datasets: [{
        data: filtered.map(r => parseFloat(r.value).toFixed(2)),
        borderColor: color,
        backgroundColor: color + '18',
        borderWidth: 1.5,
        pointRadius: filtered.length > 50 ? 0 : 3,
        pointBackgroundColor: color,
        fill: true,
        tension: 0.3
      }]
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ' ' + parseFloat(ctx.raw).toFixed(2) + ' ' + (SENSOR_UNITS[sensor] || '') } }
    },
    scales: {
      x: { ticks: { maxTicksLimit: 6, font: { family: 'DM Mono', size: 10 }, color: '#8a9bb0', maxRotation: 0 }, grid: { color: 'rgba(242,237,228,0.05)' }, border: { display: false } },
      y: { ticks: { font: { family: 'DM Mono', size: 10 }, color: '#8a9bb0' }, grid: { color: 'rgba(242,237,228,0.05)' }, border: { display: false } }
    }
  }

  const rangeLabel = { 24: 'last 24 hours', 72: 'last 3 days', 168: 'last 7 days', 720: 'last 30 days' }

  const sensors = [
    { key: 'temperature', label: 'Temperature', cls: 'temp', valueCls: 'sensor-value-temp', unit: '°F' },
    { key: 'salinity',    label: 'Salinity',    cls: 'sal',  valueCls: 'sensor-value-sal',  unit: 'ppt' },
    { key: 'do',          label: 'Dissolved O₂',cls: 'do',   valueCls: 'sensor-value-do',   unit: 'mg/L' }
  ]

  const recentRows = [...readings]
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
    .slice(0, 20)

  return (
    <div className="app">
      <div className="wl-header">
        <div>
          <div className="wl-title">Waveland Oyster Co.</div>
          <div className="wl-subtitle">Jackson Creek · Deltaville, VA · Lease #23694</div>
        </div>
        <div className="wl-device-badge">
          <div className="pulse-dot"></div>
          <span>Waveland.Buoy.23694.1</span>
        </div>
      </div>

      <div className="rainbow-stripe"></div>

      <div className="status-grid">
        {sensors.map(s => {
          const val = latest(s.key)
          const st = getStatus(s.key, val)
          const pct = barPct(s.key, val)
          return (
            <div
              key={s.key}
              className={`sensor-card ${s.cls}${sensor === s.key ? ' active' : ''}`}
              onClick={() => setSensor(s.key)}
            >
              <div className="sensor-label">{s.label}</div>
              <div className={s.valueCls}>{val !== null ? val.toFixed(1) : '--'}</div>
              <div className="sensor-unit">{s.unit}</div>
              <div className="threshold-bar">
                <div className="threshold-fill" style={{ width: pct.toFixed(1) + '%', background: SENSOR_COLORS[s.key] }}></div>
              </div>
              <div className="sensor-status">
                <div className="status-dot" style={{ background: st.color }}></div>
                <span>{val !== null ? st.label : (s.key === 'temperature' ? 'loading...' : 'no sensor yet')}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="controls-bar">
        <span className="range-label">Range:</span>
        <select value={range} onChange={e => setRange(parseInt(e.target.value))}>
          <option value={24}>Last 24 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
          <option value={720}>Last 30 days</option>
        </select>
        <span className="range-label">Sensor:</span>
        <select value={sensor} onChange={e => setSensor(e.target.value)}>
          <option value="temperature">Temperature</option>
          <option value="salinity">Salinity</option>
          <option value="do">Dissolved O₂</option>
        </select>
        <button className="refresh-btn" onClick={loadData}>↻ refresh</button>
      </div>

      <div className="chart-wrap">
        <div className="chart-container">
          <div className="chart-header">
            <div className="chart-title">{SENSOR_LABELS[sensor].split(' (')[0]} — {rangeLabel[range]}</div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: SENSOR_COLORS[sensor] }}></div>
              <span>{SENSOR_LABELS[sensor]}</span>
            </div>
          </div>
          <div style={{ position: 'relative', width: '100%', height: '240px' }}>
            <Line data={chartData()} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="section-label">Recent readings</div>
        <div className="table-outer">
          {error ? (
            <div className="no-data">Could not load data: {error}</div>
          ) : recentRows.length === 0 ? (
            <div className="no-data">Connecting to Jackson Creek...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{width:'38%'}}>Timestamp</th>
                  <th style={{width:'28%'}}>Sensor</th>
                  <th style={{width:'20%'}}>Value</th>
                  <th style={{width:'14%'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map(r => {
                  const val = parseFloat(r.value)
                  const st = getStatus(r.sensor_type, val)
                  const pillCls = 'pill-' + (r.sensor_type === 'do' ? 'do' : r.sensor_type)
                  const name = r.sensor_type === 'do' ? 'DO' : r.sensor_type.charAt(0).toUpperCase() + r.sensor_type.slice(1)
                  const unit = THRESHOLDS[r.sensor_type]?.unit || ''
                  return (
                    <tr key={r.id}>
                      <td>{formatTime(r.recorded_at)}</td>
                      <td><span className={`sensor-pill ${pillCls}`}>{name}</span></td>
                      <td>{val.toFixed(2)} {unit}</td>
                      <td style={{fontSize:'11px',color:'#8a9bb0'}}>
                        <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:st.color,marginRight:'4px',verticalAlign:'middle'}}></span>
                        {st.label}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {lastUpdated && <div className="last-updated">Last refreshed: {lastUpdated}</div>}
    </div>
  )
}
