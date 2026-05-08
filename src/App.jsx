import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const DEFAULT_SETTINGS = {
  temperature: { optimal_min: 50, optimal_max: 86, alert_min: 32, alert_max: 95 },
  salinity:    { optimal_min: 15, optimal_max: 30, alert_min: 5,  alert_max: 40 },
  do:          { optimal_min: 5,  optimal_max: 15, alert_min: 2,  alert_max: 15 }
}

const SENSOR_COLORS = { temperature: '#E8622A', salinity: '#3B9EE8', do: '#4CAF7D' }
const SENSOR_LABELS = { temperature: 'Temperature (°F)', salinity: 'Salinity (ppt)', do: 'Dissolved O₂ (mg/L)' }
const SENSOR_UNITS  = { temperature: '°F', salinity: 'ppt', do: 'mg/L' }

function loadSettings() {
  try {
    const s = localStorage.getItem('waveland_settings')
    return s ? JSON.parse(s) : DEFAULT_SETTINGS
  } catch { return DEFAULT_SETTINGS }
}

function getStatus(sensor, value, settings) {
  const t = settings[sensor]
  if (!t || value === null) return { color: '#888', label: 'no data' }
  if (value < t.alert_min || value > t.alert_max) return { color: '#E24B4A', label: 'critical' }
  if (value < t.optimal_min || value > t.optimal_max) return { color: '#F5A623', label: 'low' }
  return { color: '#4CAF7D', label: 'optimal' }
}

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatChartLabel(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function BatteryIndicator({ pct, charging }) {
  if (pct === null || pct === undefined) return null
  const color = pct > 50 ? '#4CAF7D' : pct > 25 ? '#F5A623' : '#E24B4A'
  const icon = charging ? '⚡' : '🔋'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      fontFamily: 'DM Mono, monospace', fontSize: '11px',
      color, background: '#162537',
      border: '0.5px solid rgba(242,237,228,0.1)',
      borderRadius: '20px', padding: '4px 10px'
    }}>
      <span>{icon}</span>
      <span>{Math.min(100, pct).toFixed(0)}%</span>
    </div>
  )
}

function SettingsPanel({ settings, onSave, onClose }) {
  const [local, setLocal] = useState(JSON.parse(JSON.stringify(settings)))

  const update = (sensor, field, value) => {
    setLocal(prev => ({ ...prev, [sensor]: { ...prev[sensor], [field]: parseFloat(value) } }))
  }

  const sensors = [
    { key: 'temperature', label: 'Temperature', unit: '°F' },
    { key: 'salinity',    label: 'Salinity',    unit: 'ppt' },
    { key: 'do',          label: 'Dissolved O₂', unit: 'mg/L' }
  ]

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(13,27,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#162537', border: '0.5px solid rgba(242,237,228,0.12)', borderRadius: '16px', padding: '1.75rem 2rem', width: '100%', maxWidth: '520px', margin: '0 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', color: '#f2ede4' }}>Settings</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#8a9bb0', marginTop: '2px' }}>Threshold ranges per sensor</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a9bb0', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {sensors.map(s => (
          <div key={s.key} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: SENSOR_COLORS[s.key], flexShrink: 0 }}></div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#f2ede4', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label} ({s.unit})</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8a9bb0', marginBottom: '4px', letterSpacing: '0.04em' }}>Optimal min</div>
                <input type="number" value={local[s.key].optimal_min} onChange={e => update(s.key, 'optimal_min', e.target.value)}
                  style={{ width: '100%', background: '#0d1b2a', border: '0.5px solid rgba(242,237,228,0.15)', borderRadius: '8px', padding: '6px 10px', color: '#f2ede4', fontFamily: 'DM Mono, monospace', fontSize: '13px' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8a9bb0', marginBottom: '4px', letterSpacing: '0.04em' }}>Optimal max</div>
                <input type="number" value={local[s.key].optimal_max} onChange={e => update(s.key, 'optimal_max', e.target.value)}
                  style={{ width: '100%', background: '#0d1b2a', border: '0.5px solid rgba(242,237,228,0.15)', borderRadius: '8px', padding: '6px 10px', color: '#f2ede4', fontFamily: 'DM Mono, monospace', fontSize: '13px' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#E24B4A', marginBottom: '4px', letterSpacing: '0.04em' }}>Alert min</div>
                <input type="number" value={local[s.key].alert_min} onChange={e => update(s.key, 'alert_min', e.target.value)}
                  style={{ width: '100%', background: '#0d1b2a', border: '0.5px solid rgba(226,75,74,0.3)', borderRadius: '8px', padding: '6px 10px', color: '#f2ede4', fontFamily: 'DM Mono, monospace', fontSize: '13px' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#E24B4A', marginBottom: '4px', letterSpacing: '0.04em' }}>Alert max</div>
                <input type="number" value={local[s.key].alert_max} onChange={e => update(s.key, 'alert_max', e.target.value)}
                  style={{ width: '100%', background: '#0d1b2a', border: '0.5px solid rgba(226,75,74,0.3)', borderRadius: '8px', padding: '6px 10px', color: '#f2ede4', fontFamily: 'DM Mono, monospace', fontSize: '13px' }} />
              </div>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button onClick={onClose} style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#8a9bb0', background: 'none', border: '0.5px solid rgba(242,237,228,0.15)', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(local); onClose() }} style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#0d1b2a', background: '#4CAF7D', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '500' }}>Save settings</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [readings, setReadings] = useState([])
  const [sensor, setSensor] = useState('temperature')
  const [range, setRange] = useState(168)
  const [lastUpdated, setLastUpdated] = useState('')
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)

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

  const saveSettings = (newSettings) => {
    setSettings(newSettings)
    localStorage.setItem('waveland_settings', JSON.stringify(newSettings))
  }

  const latest = (s) => {
    const sr = readings.filter(r => r.sensor_type === s)
    return sr.length ? parseFloat(sr[sr.length - 1].value) : null
  }

  const latestBattery = () => {
    const sorted = [...readings].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
    const row = sorted.find(r => r.battery_pct !== null && r.battery_pct !== undefined)
    if (!row) return { pct: null, charging: null }
    return { pct: parseFloat(row.battery_pct), charging: row.charging }
  }

  const barPct = (s, val) => {
    const t = settings[s]
    if (!t || val === null) return 0
    return Math.min(100, Math.max(0, ((val - t.alert_min) / (t.alert_max - t.alert_min)) * 100))
  }

  const chartData = readings
    .filter(r => r.sensor_type === sensor)
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
    .map(r => ({ time: formatChartLabel(r.recorded_at), value: parseFloat(parseFloat(r.value).toFixed(2)) }))

  const rangeLabel = { 24: 'last 24 hours', 72: 'last 3 days', 168: 'last 7 days', 720: 'last 30 days' }

  const sensors = [
    { key: 'temperature', label: 'Temperature', cls: 'temp', valueCls: 'sensor-value-temp', unit: '°F' },
    { key: 'salinity',    label: 'Salinity',    cls: 'sal',  valueCls: 'sensor-value-sal',  unit: 'ppt' },
    { key: 'do',          label: 'Dissolved O₂',cls: 'do',   valueCls: 'sensor-value-do',   unit: 'mg/L' }
  ]

  const recentRows = [...readings]
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
    .slice(0, 20)

  const color = SENSOR_COLORS[sensor]
  const unit = SENSOR_UNITS[sensor] || ''
  const battery = latestBattery()

  return (
    <div className="app">
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="wl-header">
        <div>
          <div className="wl-title">Waveland Oyster Co.</div>
          <div className="wl-subtitle">Jackson Creek · Deltaville, VA · Lease #23694</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BatteryIndicator pct={battery.pct} charging={battery.charging} />
          <button
            onClick={() => setShowSettings(true)}
            style={{ background: 'none', border: '0.5px solid rgba(242,237,228,0.15)', borderRadius: '8px', color: '#8a9bb0', cursor: 'pointer', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '16px', lineHeight: 1 }}
            title="Settings"
          >⚙</button>
          <div className="wl-device-badge">
            <div className="pulse-dot"></div>
            <span>Waveland.Buoy.23694.1</span>
          </div>
        </div>
      </div>

      <div className="rainbow-stripe"></div>

      <div className="status-grid">
        {sensors.map(s => {
          const val = latest(s.key)
          const st = getStatus(s.key, val, settings)
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
              <div className="legend-dot" style={{ background: color }}></div>
              <span>{SENSOR_LABELS[sensor]}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <XAxis dataKey="time" tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#8a9bb0' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#8a9bb0' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#162537', border: '0.5px solid rgba(242,237,228,0.1)', borderRadius: '8px', fontSize: '11px', fontFamily: 'DM Mono' }}
                labelStyle={{ color: '#8a9bb0', marginBottom: '4px' }}
                itemStyle={{ color }}
                formatter={v => [v + ' ' + unit, SENSOR_LABELS[sensor].split(' (')[0]]}
              />
              <ReferenceLine y={settings[sensor]?.optimal_min} stroke="#4CAF7D" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={settings[sensor]?.optimal_max} stroke="#4CAF7D" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={settings[sensor]?.alert_min} stroke="#E24B4A" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={chartData.length > 50 ? false : { fill: color, r: 3 }} activeDot={{ r: 4, fill: color }} />
            </LineChart>
          </ResponsiveContainer>
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
                 <th style={{width:'22%'}}>Timestamp</th>
<th style={{width:'27%'}}>Sensor</th>
<th style={{width:'16%'}}>Value</th>
<th style={{width:'16%'}}>Status</th>
<th style={{width:'19%'}}>Bat.</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map(r => {
                  const val = parseFloat(r.value)
                  const st = getStatus(r.sensor_type, val, settings)
                  const pillCls = 'pill-' + (r.sensor_type === 'do' ? 'do' : r.sensor_type)
                  const name = r.sensor_type === 'do' ? 'DO' : r.sensor_type.charAt(0).toUpperCase() + r.sensor_type.slice(1)
                  const u = SENSOR_UNITS[r.sensor_type] || ''
                  const batColor = r.battery_pct > 50 ? '#4CAF7D' : r.battery_pct > 25 ? '#F5A623' : '#E24B4A'
                  return (
                    <tr key={r.id}>
                      <td>{formatTime(r.recorded_at)}</td>
                      <td><span className={`sensor-pill ${pillCls}`}>{name}</span></td>
                      <td>{val.toFixed(2)} {u}</td>
                      <td style={{fontSize:'11px',color:'#8a9bb0'}}>
                        <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:st.color,marginRight:'4px',verticalAlign:'middle'}}></span>
                        {st.label}
                      </td>
                      <td style={{fontSize:'11px', color: r.battery_pct ? batColor : '#8a9bb0'}}>
                        {r.battery_pct ? `${r.charging ? '⚡' : '🔋'} ${parseFloat(r.battery_pct).toFixed(0)}%` : '--'}
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