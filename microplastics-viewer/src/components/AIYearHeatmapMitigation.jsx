import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import * as tf from "@tensorflow/tfjs";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import * as d3 from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";

/**
 * AI + Year + Mitigation Heatmap with Model Saving:
 * 1) If a trained model is in local storage, load it to skip training.
 * 2) Otherwise, parse CSV, filter out -9999, train the model, then save to local storage.
 * 3) Let user pick a year & mitigation tactic. We create a lat/lon grid, do model predictions, apply the tactic, and display a color-coded heatmap.
 */

// Example mitigation strategies
const tactics = [
  { label: "No Mitigation", value: "none" },
  { label: "Coastal Cleanup (-20% near coasts)", value: "coastal" },
  { label: "Open Ocean Skimming (-30% offshore)", value: "openocean" },
  { label: "Global Single-Use Ban (-50% overall)", value: "globalban" },
  { label: "River Interceptors (-40% lat in -10..10)", value: "river" },
];

function AIYearHeatmapMitigation() {
  const [trainingStatus, setTrainingStatus] = useState("Loading data...");
  const [model, setModel] = useState(null);

  const [years, setYears] = useState([]); // all unique years from CSV
  const [selectedYear, setSelectedYear] = useState(null);

  const [boundingBox, setBoundingBox] = useState(null); // {minLat, maxLat, minLon, maxLon, minYear, maxYear}
  const [heatmapData, setHeatmapData] = useState([]);  // final predicted points
  const [maxVal, setMaxVal] = useState(0);

  const [tactic, setTactic] = useState("none");

  useEffect(() => {
    // 1) Attempt to load a saved model from local storage
    (async () => {
      try {
        const loaded = await tf.loadLayersModel("localstorage://microplastics-model");
        console.log("Model loaded from local storage!");
        setModel(loaded);
        // We'll parse CSV just to get bounding box + years (but skip training)
        parseCsv(false);
      } catch (err) {
        console.log("No saved model found, or error loading. Will train now...");
        parseCsv(true);
      }
    })();
  }, []);

  async function parseCsv(shouldTrain) {
    Papa.parse("/Level3R1.csv", {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: (chunk) => {
        // remove lines referencing '-9999: No data'
        const lines = chunk.split(/\r\n|\n|\r/);
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes("-9999: No data")) {
            lines.splice(i, 1);
          }
        }
        return lines.join("\n");
      },
      complete: (results) => {
        const cleaned = results.data.filter((row) => {
          const lat = parseFloat(row["latitude (degree: N+, S-)"] || "");
          const lon = parseFloat(row["longitude (degree: E+, W-)"] || "");
          const pieces = parseFloat(row["Level 3p (pieces/km2)"] || "0");
          const yearStr = row["year"];
          if (!yearStr) return false;
          const yearNum = parseFloat(yearStr);

          // skip -9999 in lat/lon/pieces
          if (
            isNaN(lat) ||
            isNaN(lon) ||
            isNaN(pieces) ||
            isNaN(yearNum) ||
            lat === -9999 ||
            lon === -9999 ||
            pieces === -9999
          ) {
            return false;
          }
          return true;
        });

        // gather unique years
        const uniqueYears = [...new Set(cleaned.map(r => r["year"]))].map(y => parseFloat(y));
        uniqueYears.sort((a, b) => a - b);

        if (shouldTrain) {
          trainModel(cleaned, uniqueYears);
        } else {
          // we skip training, but still gather bounding box & years
          setupDataForPostTraining(cleaned, uniqueYears);
        }
      },
    });
  }

  function setupDataForPostTraining(rows, uniqueYears) {
    // bounding box
    let minLat = 9999, maxLat = -9999, minLon = 9999, maxLon = -9999;
    let minYear = 9999, maxYear = -9999;

    rows.forEach(r => {
      const lat = parseFloat(r["latitude (degree: N+, S-)"]);
      const lon = parseFloat(r["longitude (degree: E+, W-)"]);
      const yearNum = parseFloat(r["year"]);

      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (yearNum < minYear) minYear = yearNum;
      if (yearNum > maxYear) maxYear = yearNum;
    });

    setBoundingBox({ minLat, maxLat, minLon, maxLon, minYear, maxYear });
    setYears(uniqueYears);
    setTrainingStatus("Data loaded. Model in local storage. Pick year + tactic to see predictions.");

    if (uniqueYears.length > 0) {
      setSelectedYear(uniqueYears[0]);
    }
  }

  async function trainModel(rows, uniqueYears) {
    setTrainingStatus("Preparing data...");

    let minLat = 9999, maxLat = -9999, minLon = 9999, maxLon = -9999;
    let minYear = 9999, maxYear = -9999;

    const inputs = [];
    const labels = [];

    rows.forEach(r => {
      const lat = parseFloat(r["latitude (degree: N+, S-)"]);
      const lon = parseFloat(r["longitude (degree: E+, W-)"]);
      const pieces = parseFloat(r["Level 3p (pieces/km2)"] || "0");
      const yearNum = parseFloat(r["year"]);

      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (yearNum < minYear) minYear = yearNum;
      if (yearNum > maxYear) maxYear = yearNum;

      // input: [lat, lon, year]
      inputs.push([lat, lon, yearNum]);
      // label: [pieces]
      labels.push([pieces]);
    });

    setBoundingBox({ minLat, maxLat, minLon, maxLon, minYear, maxYear });

    const xs = tf.tensor2d(inputs);
    const ys = tf.tensor2d(labels);

    const newModel = tf.sequential();
    newModel.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [3] }));
    newModel.add(tf.layers.dense({ units: 1 }));

    newModel.compile({
      optimizer: tf.train.adam(),
      loss: "meanSquaredError",
    });

    setTrainingStatus("Training model (this may take a moment)...");
    await newModel.fit(xs, ys, {
      epochs: 20,
      batchSize: 32,
      shuffle: true,
    });

    xs.dispose();
    ys.dispose();

    // Save model to local storage
    await newModel.save("localstorage://microplastics-model");
    console.log("Model saved to local storage!");

    setModel(newModel);
    setYears(uniqueYears);
    setTrainingStatus("Training complete. Model saved. Pick a year & tactic to see predictions.");

    if (uniqueYears.length > 0) {
      setSelectedYear(uniqueYears[0]);
    }
  }

  // generate predictions each time we have model/bounding + user picks year/tactic
  useEffect(() => {
    if (!model || !boundingBox || !selectedYear) return;
    generatePredictions(model, boundingBox, selectedYear, tactic);
  }, [model, boundingBox, selectedYear, tactic]);

  function generatePredictions(mlModel, box, year, tacticVal) {
    setTrainingStatus(`Generating predictions for year ${year} with tactic '${tacticVal}'...`);

    const step = 5; // 5-degree step
    const latPoints = [];
    for (let lat = Math.floor(box.minLat); lat <= Math.ceil(box.maxLat); lat += step) {
      latPoints.push(lat);
    }
    const lonPoints = [];
    for (let lon = Math.floor(box.minLon); lon <= Math.ceil(box.maxLon); lon += step) {
      lonPoints.push(lon);
    }

    const preds = [];
    let tempMax = 0;

    latPoints.forEach(lat => {
      lonPoints.forEach(lon => {
        const inputTensor = tf.tensor2d([[lat, lon, parseFloat(year)]]);
        let val = mlModel.predict(inputTensor).dataSync()[0];
        inputTensor.dispose();

        val = applyMitigation(val, tacticVal, lat, lon);
        preds.push({ lat, lon, predValue: val });
        if (val > tempMax) tempMax = val;
      });
    });

    setHeatmapData(preds);
    setMaxVal(tempMax);
    setTrainingStatus(`AI heatmap for year ${year} + tactic '${tacticVal}' done!`);
  }

  function applyMitigation(value, tacticVal, lat, lon) {
    if (value <= 0) return 0;

    switch (tacticVal) {
      case "coastal":
        // if lat/lon within ±15 => reduce 20%
        if (Math.abs(lat) < 15 || Math.abs(lon) < 15) return value * 0.8;
        return value;
      case "openocean":
        // if lat/lon outside ±15 => reduce 30%
        if (Math.abs(lat) >= 15 && Math.abs(lon) >= 15) return value * 0.7;
        return value;
      case "globalban":
        // minus 50% overall
        return value * 0.5;
      case "river":
        // -40% if lat in -10..10
        if (lat >= -10 && lat <= 10) {
          return value * 0.6;
        }
        return value;
      case "none":
      default:
        return value;
    }
  }

  const colorScale = d3
    .scaleSequential()
    .domain([0, maxVal])
    .interpolator(interpolateYlOrRd);

  return (
    <div className="bg-white p-4 rounded shadow mt-4">
      <h2 className="text-xl font-semibold mb-2">
        AI Year Heatmap + Mitigation (Model Saved in Local Storage)
      </h2>
      <p className="text-sm text-gray-600 mb-2">{trainingStatus}</p>

      {/* Year Dropdown */}
      {years.length > 0 && (
        <div className="flex items-center space-x-2 mb-2">
          <label className="font-semibold">Select Year:</label>
          <select
            className="border p-1 rounded"
            value={selectedYear || ""}
            onChange={e => setSelectedYear(e.target.value)}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {/* Mitigation Tactic Dropdown */}
      <div className="flex items-center space-x-2 mb-4">
        <label className="font-semibold">Tactic:</label>
        <select
          className="border p-1 rounded"
          value={tactic}
          onChange={e => setTactic(e.target.value)}
        >
          {tactics.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {model && boundingBox && heatmapData.length > 0 ? (
        <div className="h-[500px] w-full">
          <MapContainer
            center={[0, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
            maxBounds={[[-90, -180],[90,180]]}
            maxBoundsViscosity={1.0}
            worldCopyJump={false}
          >
            <TileLayer
              attribution='Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              noWrap={true}
            />
            {heatmapData.map((point, i) => {
              const { lat, lon, predValue } = point;
              if (predValue <= 0) return null;

              const color = colorScale(predValue);
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
                      <strong>Year:</strong> {selectedYear}<br/>
                      <strong>Lat:</strong> {lat}, <strong>Lon:</strong> {lon}<br/>
                      <strong>Pred:</strong> {predValue.toFixed(1)}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      ) : (
        <p className="text-gray-700">Waiting for model or predictions...</p>
      )}
    </div>
  );
}

export default AIYearHeatmapMitigation;
