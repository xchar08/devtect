import React, { useEffect, useState, useRef } from 'react'
import Papa from 'papaparse'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import * as d3 from 'd3-scale'
import { interpolateYlOrRd } from 'd3-scale-chromatic'

const months = ["Jan.","Feb.","Mar.","Apr.","May","Jun.","Jul.","Aug.","Sept.","Oct.","Nov.","Dec."]

function TimeLapseMonthly() {
  const [rawData, setRawData] = useState([])
  const [monthIndex, setMonthIndex] = useState(0)
  const [maxVal, setMaxVal] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    Papa.parse('/Level3pmR1.csv', {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: (chunk) => {
        // remove lines referencing '-9999: No data' or 'Level 3pm (pieces/m3)'
        const lines = chunk.split(/\r\n|\n|\r/)
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes('-9999: No data') || lines[i].includes('Level 3pm (pieces/m3)')) {
            lines.splice(i, 1)
          }
        }
        return lines.join('\n')
      },
      complete: (results) => {
        // filter lat/lon
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

  // recalc max whenever month changes
  useEffect(() => {
    if (!rawData.length) return
    const m = months[monthIndex]
    let tempMax = 0
    rawData.forEach(r => {
      const val = parseFloat(r[m] || "0")
      if (val !== -9999 && val > tempMax) tempMax = val
    })
    setMaxVal(tempMax)
  }, [monthIndex, rawData])

  function startTimeLapse() {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      setMonthIndex(prev => (prev + 1) % months.length)
    }, 2000)
  }

  function stopTimeLapse() {
    clearInterval(intervalRef.current)
    intervalRef.current = null
  }

  const currentMonth = months[monthIndex]
  const colorScale = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(interpolateYlOrRd)

  return (
    <div className="bg-white p-4 rounded shadow mt-4">
      <h2 className="text-xl font-semibold mb-2">TimeLapse (Level3pmR1) Heatmap</h2>
      <div className="flex items-center space-x-2 mb-2">
        <button onClick={startTimeLapse} className="bg-blue-500 text-white px-3 py-1 rounded">Start</button>
        <button onClick={stopTimeLapse} className="bg-red-500 text-white px-3 py-1 rounded">Stop</button>
        <p className="text-sm text-gray-600">Current Month: <strong>{currentMonth}</strong></p>
      </div>

      <div className="h-[500px] w-full">
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
          {rawData.map((row, idx) => {
            const lat = parseFloat(row["latitude (degree: N+, S-)"] || "")
            const lon = parseFloat(row["longitude (degree: E+, W-)"] || "")
            const val = parseFloat(row[currentMonth] || "0")
            if (val === -9999) return null

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
                    <strong>{currentMonth}:</strong> {val.toFixed(1)}<br/>
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

export default TimeLapseMonthly
