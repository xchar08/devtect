import React, { useEffect, useState } from 'react'
import Papa from 'papaparse'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import * as d3 from 'd3-scale'
import { interpolateYlOrRd } from 'd3-scale-chromatic'

// Example tactics
const tactics = [
  { label: "No Mitigation", value: "none" },
  { label: "Coastal Cleanup (-20% near coasts)", value: "coastal" },
  { label: "Open Ocean Skimming (-30% offshore)", value: "openocean" },
  { label: "Global Single-Use Ban (-50% overall)", value: "globalban" },
  { label: "River Interceptors (-40% if lat in -10..10)", value: "river" },
]

function MitigationSim() {
  const [rawData, setRawData] = useState([])
  const [tactic, setTactic] = useState("none")
  const [maxVal, setMaxVal] = useState(0)

  useEffect(() => {
    Papa.parse('/Level3R1.csv', {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: chunk => {
        const lines = chunk.split(/\r\n|\n|\r/)
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes('-9999: No data')) {
            lines.splice(i, 1)
          }
        }
        return lines.join('\n')
      },
      complete: (results) => {
        const cleaned = results.data.filter(row => {
          const lat = parseFloat(row["latitude (degree: N+, S-)"] || "")
          const lon = parseFloat(row["longitude (degree: E+, W-)"] || "")
          const pieces = parseFloat(row["Level 3p (pieces/km2)"] || "0")
          if (isNaN(lat) || isNaN(lon) || isNaN(pieces)) return false
          if (lat === -9999 || lon === -9999 || pieces === -9999) return false
          return true
        })
        setRawData(cleaned)
      },
    })
  }, [])

  // Recompute max after applying tactic
  useEffect(() => {
    if (!rawData.length) return
    let tempMax = 0
    rawData.forEach(row => {
      const val = applyMitigation(parseFloat(row["Level 3p (pieces/km2)"] || "0"), tactic, row)
      if (val > tempMax) tempMax = val
    })
    setMaxVal(tempMax)
  }, [rawData, tactic])

  function applyMitigation(value, tacticVal, row) {
    if (value <= 0) return 0
    const lat = parseFloat(row["latitude (degree: N+, S-)"] || "")
    const lon = parseFloat(row["longitude (degree: E+, W-)"] || "")

    switch(tacticVal) {
      case "coastal":
        // if lat or lon within ±15 => reduce 20%
        if (Math.abs(lat) < 15 || Math.abs(lon) < 15) {
          return value * 0.8
        }
        return value
      case "openocean":
        // outside ±15 => reduce 30%
        if (Math.abs(lat) >= 15 && Math.abs(lon) >= 15) {
          return value * 0.7
        }
        return value
      case "globalban":
        // minus 50% overall
        return value * 0.5
      case "river":
        // -40% if lat in -10..10
        if (lat >= -10 && lat <= 10) {
          return value * 0.6
        }
        return value
      default:
        return value
    }
  }

  const colorScale = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(interpolateYlOrRd)

  return (
    <div className="bg-white p-4 rounded shadow mt-4">
      <h2 className="text-xl font-semibold mb-2">Mitigation Simulator (Heatmap)</h2>
      <p className="text-sm text-gray-600 mb-2">
        Circle color indicates microplastic concentration after applying tactic.
      </p>

      <label className="mr-2">Tactic:</label>
      <select
        className="border p-1 rounded"
        value={tactic}
        onChange={e => setTactic(e.target.value)}
      >
        {tactics.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <div className="h-[500px] w-full mt-4">
        <MapContainer
          center={[0, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          maxBounds={[[-90, -180],[90,180]]}
          maxBoundsViscosity={1.0}
          worldCopyJump={false}
        >
          <TileLayer
            attribution='Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            noWrap={true}
          />
          {rawData.map((row, idx) => {
            const lat = parseFloat(row["latitude (degree: N+, S-)"] || "")
            const lon = parseFloat(row["longitude (degree: E+, W-)"] || "")
            let val = parseFloat(row["Level 3p (pieces/km2)"] || "0")
            val = applyMitigation(val, tactic, row)
            if (val <= 0) return null

            const color = colorScale(val)
            return (
              <CircleMarker
                key={idx}
                center={[lat, lon]}
                radius={4}
                pathOptions={{ color, fillColor: color, fillOpacity: 1 }}
              >
                <Tooltip>
                  <div>
                    <strong>Lat:</strong> {lat}, <strong>Lon:</strong> {lon}<br/>
                    <strong>Mitigated:</strong> {val.toFixed(1)} pieces/km²
                  </div>
                </Tooltip>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}

export default MitigationSim
