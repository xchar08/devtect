import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { MapContainer, TileLayer, Tooltip, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3-scale';
import { interpolateYlOrRd } from 'd3-scale-chromatic';

function Level3Map() {
  const [rawData, setRawData] = useState([]);
  const [maxVal, setMaxVal] = useState(0);

  // Load and clean CSV data
  useEffect(() => {
    Papa.parse('/Level3R1.csv', {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: (chunk) => {
        const lines = chunk.split(/\r\n|\n|\r/);
        return lines.filter(line => !line.includes('-9999: No data')).join('\n');
      },
      complete: (results) => {
        const cleaned = results.data.filter((row) => {
          const lat = parseFloat(row['latitude (degree: N+, S-)']);
          const lon = parseFloat(row['longitude (degree: E+, W-)']);
          const pieces = parseFloat(row['Level 3p (pieces/km2)']);
          return !isNaN(lat) && !isNaN(lon) && !isNaN(pieces) && lat !== -9999 && lon !== -9999 && pieces !== -9999;
        });

        setRawData(cleaned);

        const tempMax = Math.max(...cleaned.map(row => parseFloat(row['Level 3p (pieces/km2)']) || 0));
        setMaxVal(tempMax);
      },
    });
  }, []);

  // Define color scale
  const colorScale = d3
    .scaleSequential()
    .domain([0, maxVal])
    .interpolator(interpolateYlOrRd);

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white p-6 rounded-lg shadow-lg mt-6">
      {/* Header Section */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-blue-700 text-center">
          Microplastic Heatmap
        </h1>
        <p className="text-center text-gray-600 text-lg mt-2">
          Explore microplastic concentration points.
        </p>
      </header>

      {/* Map Section */}
      <div className="relative">
        <div className="h-[600px] w-full rounded-lg shadow-lg overflow-hidden">
          <MapContainer
            center={[20, 0]} // Pre-zoomed center (latitude, longitude)
            zoom={3} // Adjusted zoom level for a pre-zoomed map
            style={{ height: '100%', width: '100%' }}
            maxBounds={[
              [-90, -180],
              [90, 180],
            ]}
            maxBoundsViscosity={1.0}
          >
            <TileLayer
              attribution='Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              noWrap
            />

            {/* Render Data Points */}
            {rawData.map((row, index) => {
              const lat = parseFloat(row['latitude (degree: N+, S-)']);
              const lon = parseFloat(row['longitude (degree: E+, W-)']);
              const val = parseFloat(row['Level 3p (pieces/km2)']);
              const color = colorScale(val);

              return (
                <CircleMarker
                  key={index}
                  center={[lat, lon]}
                  radius={6}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.85,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={1}>
                    <div className="text-sm text-gray-800">
                      <strong>Latitude:</strong> {lat.toFixed(2)} <br />
                      <strong>Longitude:</strong> {lon.toFixed(2)} <br />
                      <strong>Concentration:</strong> {val.toFixed(1)} pieces/km²
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default Level3Map;
