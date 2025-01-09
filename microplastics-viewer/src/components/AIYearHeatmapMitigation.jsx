// src/components/AIYearHeatmapMitigation.jsx
import React, { useEffect, useState, useMemo } from "react";
import Papa from "papaparse";
import * as tf from "@tensorflow/tfjs";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import * as d3 from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";
import { ClipLoader } from "react-spinners";

import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const timeIncrements = [
  { label: "6 Months", value: 0.5 },
  { label: "1 Year", value: 1 },
  { label: "2 Years", value: 2 },
  { label: "5 Years", value: 5 },
  { label: "10 Years", value: 10 },
];

const tactics = [
  { 
    label: "No Mitigation", 
    value: "none", 
    description: "No actions taken to reduce microplastics.", 
    type: "none", 
    rate: 0,
    applies: () => true 
  },
  { 
    label: "Coastal Cleanup (-20% near coasts)", 
    value: "coastal", 
    description: "Reduces microplastics by 20% near coastal regions.", 
    type: "perYear", 
    rate: 0.2,
    applies: (lat, lon) => Math.abs(lat) < 15 || Math.abs(lon) < 15
  },
  { 
    label: "Open Ocean Skimming (-30% offshore)", 
    value: "openocean", 
    description: "Reduces microplastics by 30% in open ocean areas.", 
    type: "perYear", 
    rate: 0.3,
    applies: (lat, lon) => Math.abs(lat) >= 15 && Math.abs(lon) >= 15
  },
  { 
    label: "Global Single-Use Ban (-50% overall)", 
    value: "globalban", 
    description: "Reduces microplastics by 50% globally.", 
    type: "oneTime", 
    rate: 0.5,
    applies: () => true
  },
  { 
    label: "River Interceptors (-40% if lat in -10..10)", 
    value: "river", 
    description: "Reduces microplastics by 40% in regions near rivers.", 
    type: "perYear", 
    rate: 0.4,
    applies: (lat, lon) => lat >= -10 && lat <= 10
  },
  // ... Add additional tactics as needed ...
];

const MODEL_VERSION = "v2"; 
const MODEL_URL = `localstorage://microplastics-model-${MODEL_VERSION}`;

function AIYearHeatmapMitigation() {
  const [trainingStatus, setTrainingStatus] = useState("Loading data...");
  const [model, setModel] = useState(null);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [timeIncrement, setTimeIncrement] = useState(0);
  const [tactic, setTactic] = useState("none");
  const [boundingBox, setBoundingBox] = useState(null);
  const [heatmapData, setHeatmapData] = useState([]);
  const [maxVal, setMaxVal] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionProgress, setPredictionProgress] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const loadedModel = await tf.loadLayersModel(MODEL_URL);
        console.log(`Model loaded from local storage (${MODEL_URL})!`);
        setModel(loadedModel);
        parseCsv(false);
      } catch (err) {
        console.log(`No saved model found at ${MODEL_URL} or error loading. Training now...`);
        try {
          const olderModelURL = `localstorage://microplastics-model-${MODEL_VERSION}`;
          await tf.io.removeModel(olderModelURL);
          console.log(`Existing model (${olderModelURL}) removed from local storage.`);
        } catch (removeError) {
          console.warn("No existing model to remove or error removing model:", removeError);
        }
        parseCsv(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function parseCsv(shouldTrain) {
    Papa.parse("/Level3R1.csv", {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: (chunk) => {
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
          const pieces = parseFloat(row["Level 3p (pieces/km2)"] || "");
          const yearStr = row["year"];
          const defaultYear = 2025;
          let yearNum;
          if (!yearStr) {
            yearNum = defaultYear;
          } else {
            yearNum = parseFloat(yearStr);
            if (isNaN(yearNum)) return false;
          }
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
          if (!yearStr) {
            row["year"] = yearNum;
          }
          return true;
        });

        if (cleaned.length > 0) {
          const uniqueYearsSet = new Set(cleaned.map((r) => parseFloat(r["year"])));
          uniqueYearsSet.add(2025);
          const uniqueYears = Array.from(uniqueYearsSet).sort((a, b) => a - b);

          if (shouldTrain) {
            trainModel(cleaned, uniqueYears);
          } else {
            setupDataForPostTraining(cleaned, uniqueYears);
          }
        } else {
          setTrainingStatus("No valid data available for training.");
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        setTrainingStatus("Error loading data. Please check the CSV file.");
      },
    });
  }

  function setupDataForPostTraining(rows, uniqueYears) {
    let minLat = 9999, maxLat = -9999, minLon = 9999, maxLon = -9999;
    let minYear = 9999, maxYear = -9999;

    rows.forEach((r) => {
      const lat = parseFloat(r["latitude (degree: N+, S-)"]);
      const lon = parseFloat(r["longitude (degree: E+, W-)"]);
      const yearNum = parseFloat(r["year"] || "2025");
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (yearNum < minYear) minYear = yearNum;
      if (yearNum > maxYear) maxYear = yearNum;
    });

    setBoundingBox({ minLat, maxLat, minLon, maxLon, minYear, maxYear });
    setYears(uniqueYears);
    setTrainingStatus("Data loaded. Model is ready. Select year, time increment, & tactic to see predictions.");
    if (uniqueYears.includes(2025)) {
      setSelectedYear(2025);
    } else if (uniqueYears.length > 0) {
      setSelectedYear(uniqueYears[0]);
    }
  }

  async function trainModel(rows, uniqueYears) {
    setTrainingStatus("Preparing data for training...");
    setIsTraining(true);
    setTrainingProgress(0);

    let minLat = 9999, maxLat = -9999, minLon = 9999, maxLon = -9999;
    let minYear = 9999, maxYear = -9999;
    const inputs = [];
    const labels = [];

    rows.forEach((r) => {
      const lat = parseFloat(r["latitude (degree: N+, S-)"]);
      const lon = parseFloat(r["longitude (degree: E+, W-)"]);
      const pieces = parseFloat(r["Level 3p (pieces/km2)"] || "0");
      const yearNum = parseFloat(r["year"] || "2025");
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (yearNum < minYear) minYear = yearNum;
      if (yearNum > maxYear) maxYear = yearNum;
      inputs.push([lat, lon, yearNum]);
      labels.push([pieces]);
    });

    setBoundingBox({ minLat, maxLat, minLon, maxLon, minYear, maxYear });

    let xs, ys;
    try {
      xs = tf.tensor2d(inputs, [inputs.length, 3]);
      ys = tf.tensor2d(labels, [labels.length, 1]);
    } catch (error) {
      setTrainingStatus("Error processing data for training.");
      setIsTraining(false);
      return;
    }

    const newModel = tf.sequential();
    newModel.add(tf.layers.dense({ units: 32, activation: "relu", inputShape: [3] }));
    newModel.add(tf.layers.dense({ units: 16, activation: "relu" }));
    newModel.add(tf.layers.dense({ units: 1 }));

    newModel.compile({
      optimizer: tf.train.adam(),
      loss: "meanSquaredError",
    });

    setTrainingStatus("Training model...");
    try {
      await newModel.fit(xs, ys, {
        epochs: 30,
        batchSize: 64,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch) => {
            const progress = Math.round(((epoch + 1) / 30) * 100);
            setTrainingProgress(progress);
            setTrainingStatus(`Training model... Epoch ${epoch + 1}/30`);
          },
          onTrainEnd: async () => {
            setIsTraining(false);
            setTrainingProgress(100);
            setTrainingStatus("Training complete. Model saved. Select year, time increment, & tactic to see predictions.");
            try {
              await newModel.save(MODEL_URL);
              console.log(`Model saved to local storage (${MODEL_URL})!`);
            } catch (error) {
              setTrainingStatus("Error saving the model. Check console for details.");
            }
            setModel(newModel);
          },
          onError: (error) => {
            console.error("Training error:", error);
            setTrainingStatus("Error during training. Check console for details.");
            setIsTraining(false);
          },
        },
      });
    } catch (error) {
      setTrainingStatus("Exception during training. Check console for details.");
      setIsTraining(false);
    }

    xs.dispose();
    ys.dispose();

    setYears(uniqueYears);
    if (uniqueYears.includes(2025)) {
      setSelectedYear(2025);
    } else if (uniqueYears.length > 0) {
      setSelectedYear(uniqueYears[0]);
    }
  }

  useEffect(() => {
    if (!model || !boundingBox || selectedYear === null) return;
    generatePredictions(model, boundingBox, selectedYear, timeIncrement, tactic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, boundingBox, selectedYear, timeIncrement, tactic]);

  async function generatePredictions(mlModel, box, year, timeInc, tacticVal) {
    setTrainingStatus(`Generating predictions...`);
    setIsPredicting(true);
    setPredictionProgress(0);
    const targetYear = parseFloat(year) + timeInc;
    const step = 10;
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
    const inputArray = [];
    lonPoints.forEach((lon) => {
      latPoints.forEach((lat) => {
        inputArray.push([lat, lon, targetYear]);
      });
    });

    const years = Math.floor(timeInc);
    try {
      const inputTensor = tf.tensor2d(inputArray, [inputArray.length, 3]);
      const outputTensor = mlModel.predict(inputTensor);
      const outputData = await outputTensor.array();
      setPredictionProgress(100);

      outputData.forEach((pred, idx) => {
        let val = pred[0];
        const lat = inputArray[idx][0];
        const lon = inputArray[idx][1];
        val = applyMitigationStrategy(val, tacticVal, lat, lon, years);
        preds.push({ lat, lon, predVal: val });
        if (val > tempMax) tempMax = val;
      });

      inputTensor.dispose();
      outputTensor.dispose();

      setHeatmapData(preds);
      setMaxVal(tempMax);
      setTrainingStatus(`Predictions generated!`);
    } catch (error) {
      console.error("Prediction error:", error);
      setTrainingStatus("Error during prediction. Check console for details.");
    }
    setIsPredicting(false);
  }

  function applyMitigationStrategy(value, tacticVal, lat, lon, years) {
    const selectedTactic = tactics.find(t => t.value === tacticVal);
    if (!selectedTactic) return value;
    if (!selectedTactic.applies(lat, lon)) return value;
    let finalValue = value;
    if (selectedTactic.type === "perYear") {
      const fullYears = Math.floor(years);
      finalValue = value * Math.pow(1 - selectedTactic.rate, fullYears);
    } else if (selectedTactic.type === "oneTime") {
      finalValue = value * (1 - selectedTactic.rate);
    }
    return Math.max(finalValue, 0);
  }

  function getTacticLabel(value) {
    const tactic = tactics.find(t => t.value === value);
    return tactic ? tactic.label : "Unknown";
  }

  const colorScale = useMemo(() => {
    return d3
      .scaleSequential()
      .domain([0, maxVal])
      .interpolator(interpolateYlOrRd);
  }, [maxVal]);

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white p-6">
      {/* Header Section */}
      <header className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-blue-700">
          AI Year Heatmap + Mitigation Strategies
        </h2>
        <p className="text-gray-600 text-lg mt-2">
          Utilize our AI-driven models to predict future microplastic scenarios and visualize the impact of various mitigation strategies.
        </p>
      </header>

      {/* Selection Controls */}
      <div className="flex flex-col md:flex-row md:space-x-6 space-y-4 md:space-y-0 mb-8 w-full">
        {years.length > 0 && (
          <div className="flex flex-col flex-1">
            <label htmlFor="year" className="font-medium mb-1">Select Year:</label>
            <select
              id="year"
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedYear || ""}
              onChange={(e) => setSelectedYear(parseFloat(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col flex-1">
          <label htmlFor="timeIncrement" className="font-medium mb-1">Time Increment:</label>
          <select
            id="timeIncrement"
            className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={timeIncrement}
            onChange={(e) => setTimeIncrement(parseFloat(e.target.value))}
          >
            {timeIncrements.map((ti, idx) => (
              <option key={idx} value={ti.value}>
                {ti.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col flex-1">
          <label htmlFor="tactic" className="font-medium mb-1">Mitigation Tactic:</label>
          <select
            id="tactic"
            className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={tactic}
            onChange={(e) => setTactic(e.target.value)}
          >
            {tactics.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Indicators */}
      <div className="space-y-6 mb-8">
        {isTraining && (
          <div className="flex items-center space-x-4">
            <ClipLoader color="#1d4ed8" size={30} />
            <div>
              <p className="text-gray-700">Training Progress: {trainingProgress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full"
                  style={{ width: `${trainingProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {isPredicting && (
          <div className="flex items-center space-x-4">
            <ClipLoader color="#16a34a" size={30} />
            <div>
              <p className="text-gray-700">Prediction Progress: {predictionProgress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-600 h-4 rounded-full"
                  style={{ width: `${predictionProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Heatmap Display */}
      {model && boundingBox && heatmapData.length > 0 ? (
        <div className="h-screen w-full rounded-lg shadow-lg overflow-hidden">
          <MapContainer
            center={[20, 0]}
            zoom={3}
            style={{ height: "100%", width: "100%" }}
            maxBounds={[
              [-90, -180],
              [90, 180]
            ]}
            maxBoundsViscosity={1.0}
          >
            <TileLayer
              attribution='Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              noWrap={true}
            />
            {heatmapData.map((point, i) => {
              const { lat, lon, predVal } = point;
              if (predVal <= 0) return null;
              const color = colorScale(predVal);
              return (
                <CircleMarker
                  key={i}
                  center={[lat, lon]}
                  radius={4}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.8,
                  }}
                >
                  <Tooltip>
                    <div>
                      <strong>Lat:</strong> {lat}, <strong>Lon:</strong> {lon}<br />
                      <strong>Year:</strong> {selectedYear + Math.floor(timeIncrement)}<br />
                      <strong>Mitigation:</strong> {getTacticLabel(tactic)}<br />
                      <strong>Predicted:</strong> {predVal.toFixed(1)} pieces/km²
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-screen w-full rounded-lg shadow-lg bg-gray-100">
          <p className="text-gray-700">Waiting for training/predictions...</p>
        </div>
      )}
    </div>
  );
}

export default AIYearHeatmapMitigation;
