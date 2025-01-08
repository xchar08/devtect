import React, { useEffect, useState } from 'react'
import Papa from 'papaparse'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import * as d3 from 'd3-scale'
import { interpolateYlOrRd } from 'd3-scale-chromatic'

const months = ["Jan.","Feb.","Mar.","Apr.","May","Jun.","Jul.","Aug.","Sept.","Oct.","Nov.","Dec."]

function Level3wmMonthly() {
  const [rawData, setRawData] = useState([])
  const [month, setMonth] = useState("Jan.")
  const [maxVal, setMaxVal] = useState(0)

  useEffect(() => {
    Papa.parse('/Level3wmR1.csv', {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: (chunk) => {
        // remove lines referencing '-9999: No data' or the extra heading line
        const lines = chunk.split(/\r\n|\n|\r/)
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes('-9999: No data') || lines[i].includes('Level 3wm (mg/m3)')) {
            lines.splice(i, 1)
          }
        }
        return lines.join('\n')
      },
      complete: (results) => {
        // Filter out lat/lon or monthly = -9999
        const cleaned = results.data.filter((row) => {
          const lat = parseFloat(row["latitude (degree: N+, S-)"] || "")
          const lon = parseFloat(row["longitude (degree: E+, W-)"] || "")
          if (isNaN(lat) || isNaN(lon)) return false
          if (lat === -9999 || lon === -9999) return false
          return true
        })
        setRawData(cleaned)

        // initial max from Jan
        let tempMax = 0
        cleaned.forEach(r => {
          const val = parseFloat(r["Jan."] || "0")
          if (val !== -9999 && val > tempMax) tempMax = val
        })
        setMaxVal(tempMax)
      },
    })
  }, [])

  // re-check max if month changes
  useEffect(() => {
    if (!rawData.length) return
    let tempMax = 0
    rawData.forEach(r => {
      const val = parseFloat(r[month] || "0")
      if (val !== -9999 && val > tempMax) tempMax = val
    })
    setMaxVal(tempMax)
  }, [month, rawData])

  const colorScale = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(interpolateYlOrRd)

  return (
    <div className="bg-white p-4 rounded shadow mt-4">
      <h2 className="text-xl font-semibold mb-2">Level3wmR1 - Monthly Heatmap</h2>
      <label className="mr-2">Select Month:</label>
      <select
        className="border p-1 rounded"
        value={month}
        onChange={e => setMonth(e.target.value)}
      >
        {months.map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      <div className="h-[500px] w-full mt-4">
        <MapContainer
          center={[0,0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          maxBounds={[[-90,-180],[90,180]]}
          maxBoundsViscosity={1.0}
          worldCopyJump={false}
        >
          <TileLayer
            attribution='Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            noWrap={true}
          />
          {rawData.map((row, i) => {
            const lat = parseFloat(row["latitude (degree: N+, S-)"] || "")
            const lon = parseFloat(row["longitude (degree: E+, W-)"] || "")
            const val = parseFloat(row[month] || "0")
            if (val === -9999) return null

            const color = colorScale(val)

            return (
              <CircleMarker
                key={i}
                center={[lat, lon]}
                radius={4}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 1,
                }}
              >
                <Tooltip>
                  <div>
                    <strong>{month}:</strong> {val.toFixed(1)} mg/m3<br/>
                    Lat: {lat}, Lon: {lon}
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

export default Level3wmMonthly
