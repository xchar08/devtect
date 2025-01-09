import React, { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3-scale';
import { interpolateYlOrRd } from 'd3-scale-chromatic';

// Expanded Mitigation Strategies
const tactics = [
  { label: 'No Mitigation', value: 'none', type: 'none', rate: 0, applies: () => true },
  { label: 'Coastal Cleanup (-20% near coasts)', value: 'coastal', type: 'perYear', rate: 0.2, applies: (lat, lon) => Math.abs(lat) < 15 || Math.abs(lon) < 15 },
  { label: 'Open Ocean Skimming (-30% offshore)', value: 'openocean', type: 'perYear', rate: 0.3, applies: (lat, lon) => Math.abs(lat) >= 15 && Math.abs(lon) >= 15 },
  { label: 'Global Single-Use Ban (-50% overall)', value: 'globalban', type: 'oneTime', rate: 0.5, applies: () => true },
  { label: 'River Interceptors (-40% if lat in -10..10)', value: 'river', type: 'perYear', rate: 0.4, applies: (lat, lon) => lat >= -10 && lat <= 10 },
  { label: 'Biodegradable Plastics Promotion (-25% overall)', value: 'biodegradable', type: 'oneTime', rate: 0.25, applies: () => true },
  { label: 'Industrial Filtration Systems (-35% near industrial areas)', value: 'industrial', type: 'perYear', rate: 0.35, applies: (lat, lon) => Math.abs(lat) < 30 && Math.abs(lon) < 30 },
  { label: 'Public Awareness Campaigns (-15% overall)', value: 'awareness', type: 'oneTime', rate: 0.15, applies: () => true },
  { label: 'Advanced Waste Management (-40% in urban areas)', value: 'wastemanagement', type: 'perYear', rate: 0.4, applies: (lat, lon) => Math.abs(lat) <= 45 && Math.abs(lon) <= 45 },
  { label: 'Legislation on Plastic Production (-30% globally)', value: 'legislation', type: 'oneTime', rate: 0.3, applies: () => true },
  { label: 'Ocean Restoration Projects (-20% globally)', value: 'oceanrestoration', type: 'oneTime', rate: 0.2, applies: () => true },
  { label: 'Erosion Control Measures (-25% in vulnerable areas)', value: 'erosioncontrol', type: 'perYear', rate: 0.25, applies: (lat, lon) => lat >= -20 && lat <= 20 },
];

function MitigationSim() {
  const [rawData, setRawData] = useState([]);
  const [selectedTactic, setSelectedTactic] = useState('none');
  const [maxVal, setMaxVal] = useState(0);

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
      },
    });
  }, []);

  useEffect(() => {
    if (!rawData.length) return;
    const tempMax = rawData.reduce((max, row) => {
      const val = applyMitigation(parseFloat(row['Level 3p (pieces/km2)']), selectedTactic, row);
      return Math.max(max, val);
    }, 0);
    setMaxVal(tempMax);
  }, [rawData, selectedTactic]);

  const applyMitigation = (value, tacticVal, row) => {
    if (value <= 0) return 0;
    const lat = parseFloat(row['latitude (degree: N+, S-)']);
    const lon = parseFloat(row['longitude (degree: E+, W-)']);
    const tactic = tactics.find(t => t.value === tacticVal);
    if (!tactic || tactic.type === 'none' || !tactic.applies(lat, lon)) return value;
    return Math.max(value * (1 - tactic.rate), 0);
  };

  const colorScale = useMemo(() => d3.scaleSequential().domain([0, maxVal]).interpolator(interpolateYlOrRd), [maxVal]);

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white p-6 rounded-lg shadow-lg mt-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-blue-700 text-center">Mitigation Simulator</h1>
        <p className="text-center text-gray-600 text-lg mt-2">
          Visualize the impact of mitigation strategies on microplastic concentration.
        </p>
      </header>

      <div className="mb-4">
        <label htmlFor="tactic-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select a Mitigation Strategy:
        </label>
        <select
          id="tactic-select"
          className="block w-full border border-gray-300 rounded-lg p-2 shadow-sm focus:ring-blue-500 focus:border-blue-500"
          value={selectedTactic}
          onChange={(e) => setSelectedTactic(e.target.value)}
        >
          {tactics.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative h-[600px] w-full rounded-lg shadow-lg overflow-hidden">
        <MapContainer
          center={[20, 0]} // Pre-zoomed center (latitude, longitude)
          zoom={3} // Adjusted zoom level for better initial focus
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
          {rawData.map((row, idx) => {
            const lat = parseFloat(row['latitude (degree: N+, S-)']);
            const lon = parseFloat(row['longitude (degree: E+, W-)']);
            const val = applyMitigation(parseFloat(row['Level 3p (pieces/km2)']), selectedTactic, row);
            if (val <= 0) return null;

            const color = colorScale(val);
            return (
              <CircleMarker
                key={idx}
                center={[lat, lon]}
                radius={6}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}
              >
                <Tooltip>
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
  );
}

export default MitigationSim;
