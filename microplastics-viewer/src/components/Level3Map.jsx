import React, { useEffect, useState } from 'react'
import Papa from 'papaparse'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import * as d3 from 'd3-scale'
import { interpolateYlOrRd } from 'd3-scale-chromatic'

function Level3Map() {
  const [rawData, setRawData] = useState([])
  const [maxVal, setMaxVal] = useState(0)

  useEffect(() => {
    Papa.parse('/Level3R1.csv', {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: (chunk) => {
        // remove lines referencing '-9999: No data'
        const lines = chunk.split(/\r\n|\n|\r/)
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes('-9999: No data')) {
            lines.splice(i, 1)
          }
        }
        return lines.join('\n')
      },
      complete: (results) => {
        // Filter out rows where lat/lon or microplastic = -9999
        const cleaned = results.data.filter((row) => {
          const lat = parseFloat(row["latitude (degree: N+, S-)"] || "")
          const lon = parseFloat(row["longitude (degree: E+, W-)"] || "")
          const pieces = parseFloat(row["Level 3p (pieces/km2)"] || "0")

          if (isNaN(lat) || isNaN(lon) || isNaN(pieces)) return false
          if (lat === -9999 || lon === -9999 || pieces === -9999) return false
          return true
        })

        setRawData(cleaned)

        // Find max
        let tempMax = 0
        cleaned.forEach(row => {
          const val = parseFloat(row["Level 3p (pieces/km2)"] || "0")
          if (val > tempMax) tempMax = val
        })
        setMaxVal(tempMax)
      },
    })
  }, [])

  // define color scale
  const colorScale = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(interpolateYlOrRd)

  return (
    <div className="bg-white p-4 rounded shadow mt-4">
      <h2 className="text-xl font-semibold mb-2">Level3R1 Heatmap</h2>
      <p className="text-sm text-gray-600">
        Circle color indicates microplastic concentration (pieces/km2).
      </p>
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
          {rawData.map((row, i) => {
            const lat = parseFloat(row["latitude (degree: N+, S-)"] || "")
            const lon = parseFloat(row["longitude (degree: E+, W-)"] || "")
            const val = parseFloat(row["Level 3p (pieces/km2)"] || "0")

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
                    <strong>Lat:</strong> {lat}, <strong>Lon:</strong> {lon}<br/>
                    <strong>Pieces/km2:</strong> {val.toFixed(1)}
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

export default Level3Map
