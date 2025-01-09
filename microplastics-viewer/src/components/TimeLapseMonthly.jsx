import React, { useEffect, useState, useRef } from 'react';
import Papa from 'papaparse';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3-scale';
import { interpolateYlOrRd } from 'd3-scale-chromatic';

const months = ["Jan.","Feb.","Mar.","Apr.","May","Jun.","Jul.","Aug.","Sept.","Oct.","Nov.","Dec."];

function TimeLapseMonthly() {
  const [rawData, setRawData] = useState([]);
  const [monthIndex, setMonthIndex] = useState(0);
  const [maxVal, setMaxVal] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    Papa.parse('/Level3pmR1.csv', {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: chunk => {
        const lines = chunk.split(/\r\n|\n|\r/);
        if (lines.length && lines[0].includes('Level 3pm (pieces/m3)')) {
          lines.shift();
        }
        return lines.join('\n');
      },
      complete: (results) => {
        const cleaned = results.data.filter(row => {
          const lat = parseFloat(row["latitude (degree: N+, S-)"] || "");
          const lon = parseFloat(row["longitude (degree: E+, W-)"] || "");
          if (isNaN(lat) || isNaN(lon)) return false;
          if (lat === -9999 || lon === -9999) return false;
          return true;
        });
        setRawData(cleaned);

        // initial max from Jan
        let tempMax = 0;
        cleaned.forEach(r => {
          const val = parseFloat(r["Jan."] || "0");
          if (val > tempMax) tempMax = val;
        });
        setMaxVal(tempMax);
      },
    });
  }, []);

  // Recompute maxVal if monthIndex changes
  useEffect(() => {
    if (!rawData.length) return;
    const m = months[monthIndex];
    let tempMax = 0;
    rawData.forEach(r => {
      const val = parseFloat(r[m] || "0");
      if (val > tempMax) tempMax = val;
    });
    setMaxVal(tempMax);
  }, [monthIndex, rawData]);

  const currentMonth = months[monthIndex];

  const colorScale = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(interpolateYlOrRd);

  function startTimeLapse() {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      setMonthIndex(prev => (prev + 1) % months.length);
    }, 2000); // cycle every 2s
  }
  function stopTimeLapse() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white p-6">
      <header className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-blue-700 mb-4">
          TimeLapse: Level3pm (Heatmap)
        </h2>
        <div className="flex flex-col items-center justify-center w-full mb-4">
          <p className="text-sm text-gray-600">
            Current Month: <strong>{currentMonth}</strong>
          </p>
          <br/>
          <div className="flex w-full space-x-2 mb-2">
            <button
              onClick={startTimeLapse}
              className="flex-1 bg-blue-500 text-white px-2 py-1 rounded"
            >
              Start
            </button>
            <button
              onClick={stopTimeLapse}
              className="flex-1 bg-red-500 text-white px-2 py-1 rounded"
            >
              Stop
            </button>
          </div>
        </div>
      </header>

      <div className="h-screen w-full rounded-lg shadow-lg overflow-hidden">
        <MapContainer
          center={[20, 0]}
          zoom={3}
          style={{ height: '100%', width: '100%' }}
          maxBounds={[
            [-90, -180],
            [90, 180]
          ]}
          maxBoundsViscosity={1.0}
          worldCopyJump={false}
        >
          <TileLayer
            attribution='Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            noWrap={true}
          />
          {rawData.map((row, idx) => {
            const lat = parseFloat(row["latitude (degree: N+, S-)"] || "");
            const lon = parseFloat(row["longitude (degree: E+, W-)"] || "");
            const val = parseFloat(row[currentMonth] || "0");
            if (val === -9999) return null;

            const color = colorScale(val);
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
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

export default TimeLapseMonthly;
