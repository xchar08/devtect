// src/components/AIYearHeatmapMitigation.jsx
import React, { useEffect, useState, useMemo } from "react";
import Papa from "papaparse";
import * as tf from "@tensorflow/tfjs";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import * as d3 from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";

/**
 * AI + Year + Mitigation + Time Increment Heatmap with Model Saving and Performance Optimizations:
 * 1) Load a trained model from local storage to skip training.
 * 2) If no model exists, parse CSV, filter out -9999, train the model, then save it.
 * 3) Let user pick a year, time increment, & mitigation tactic.
 * 4) Generate predictions based on selections, apply mitigation, and display as individual CircleMarkers.
 */

// Mitigation Strategies
const tactics = [
  { label: "No Mitigation", value: "none" },
  { label: "Coastal Cleanup (-20% near coasts)", value: "coastal" },
  { label: "Open Ocean Skimming (-30% offshore)", value: "openocean" },
  { label: "Global Single-Use Ban (-50% overall)", value: "globalban" },
  { label: "River Interceptors (-40% lat in -10..10)", value: "river" },
];

// Time Increments (in years)
const timeIncrements = [
  { label: "After 1 Month", value: 1 / 12 },
  { label: "After 2 Months", value: 2 / 12 },
  { label: "After 3 Months", value: 3 / 12 },
  { label: "After 6 Months", value: 6 / 12 },
  { label: "After 9 Months", value: 9 / 12 },
  { label: "After 1 Year", value: 1 },
];

function AIYearHeatmapMitigation() {
  // Primary States
  const [trainingStatus, setTrainingStatus] = useState("Loading data...");
  const [model, setModel] = useState(null);

  const [years, setYears] = useState([]); // All unique years from CSV
  const [selectedYear, setSelectedYear] = useState(null);

  const [timeIncrement, setTimeIncrement] = useState(0); // in years
  const [tactic, setTactic] = useState("none");

  const [boundingBox, setBoundingBox] = useState(null); // {minLat, maxLat, minLon, maxLon, minYear, maxYear}
  const [heatmapData, setHeatmapData] = useState([]); // {lat, lon, predVal}
  const [maxVal, setMaxVal] = useState(0);

  // Progress States
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0); // 0 to 100
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionProgress, setPredictionProgress] = useState(0); // 0 to 100

  // Load or Train Model on Component Mount
  useEffect(() => {
    (async () => {
      try {
        const loadedModel = await tf.loadLayersModel("localstorage://microplastics-model");
        console.log("Model loaded from local storage!");
        setModel(loadedModel);
        parseCsv(false);
      } catch (err) {
        console.log("No saved model found or error loading. Training now...");
        parseCsv(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parse CSV and optionally train the model
  async function parseCsv(shouldTrain) {
    Papa.parse("/Level3R1.csv", {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: (chunk) => {
        // Remove lines containing '-9999: No data'
        const lines = chunk.split(/\r\n|\n|\r/);
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes("-9999: No data")) {
            lines.splice(i, 1);
          }
        }
        return lines.join("\n");
      },
      complete: (results) => {
        console.log("CSV Columns:", results.meta.fields);
        console.log("Raw parsed data (first 5 rows):", results.data.slice(0, 5));

        const cleaned = results.data.filter((row) => {
          const lat = parseFloat(row["latitude (degree: N+, S-)"] || "");
          const lon = parseFloat(row["longitude (degree: E+, W-)"] || "");
          const pieces = parseFloat(row["Level 3p (pieces/km2)"] || "");
          const yearStr = row["year"]; // Modify if 'year' column has a different name
          const defaultYear = 2025; // Assign 2025 as default year if missing

          let yearNum;
          if (!yearStr) {
            console.log("Assigning default year 2025 due to missing 'year' in row:", row);
            yearNum = defaultYear;
          } else {
            yearNum = parseFloat(yearStr);
            if (isNaN(yearNum)) {
              console.log("Filtering out row due to invalid 'year':", row);
              return false;
            }
          }

          // Log rows being filtered out due to invalid data
          if (
            isNaN(lat) ||
            isNaN(lon) ||
            isNaN(pieces) ||
            isNaN(yearNum) ||
            lat === -9999 ||
            lon === -9999 ||
            pieces === -9999
          ) {
            console.log("Filtering out row due to invalid data:", row);
            return false;
          }

          // If 'year' was missing, assign the default year
          if (!yearStr) {
            row["year"] = yearNum;
          }

          return true;
        });

        console.log("Cleaned data length:", cleaned.length);
        if (cleaned.length > 0) {
          // Gather unique years, including 2025 if not present
          const uniqueYearsSet = new Set(cleaned.map((r) => parseFloat(r["year"])));
          uniqueYearsSet.add(2025); // Ensure 2025 is included
          const uniqueYears = Array.from(uniqueYearsSet).sort((a, b) => a - b);

          if (shouldTrain) {
            trainModel(cleaned, uniqueYears);
          } else {
            // Setup bounding box and years without training
            setupDataForPostTraining(cleaned, uniqueYears);
          }
        } else {
          console.error("No valid data after cleaning.");
          setTrainingStatus("No valid data available for training.");
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        setTrainingStatus("Error loading data. Please check the CSV file.");
      },
    });
  }

  // Setup bounding box and years after loading data
  function setupDataForPostTraining(rows, uniqueYears) {
    let minLat = 9999,
      maxLat = -9999,
      minLon = 9999,
      maxLon = -9999;
    let minYear = 9999,
      maxYear = -9999;

    rows.forEach((r) => {
      const lat = parseFloat(r["latitude (degree: N+, S-)"]);
      const lon = parseFloat(r["longitude (degree: E+, W-)"]);
      const yearNum = parseFloat(r["year"] || "2025"); // Assign default year if missing

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

    // Set selectedYear to 2025 if available, else to the first year
    if (uniqueYears.includes(2025)) {
      setSelectedYear(2025);
    } else if (uniqueYears.length > 0) {
      setSelectedYear(uniqueYears[0]);
    }
  }

  // Train the TensorFlow.js Model
  async function trainModel(rows, uniqueYears) {
    setTrainingStatus("Preparing data for training...");
    setIsTraining(true);
    setTrainingProgress(0);

    let minLat = 9999,
      maxLat = -9999,
      minLon = 9999,
      maxLon = -9999;
    let minYear = 9999,
      maxYear = -9999;

    const inputs = [];
    const labels = [];

    rows.forEach((r) => {
      const lat = parseFloat(r["latitude (degree: N+, S-)"]);
      const lon = parseFloat(r["longitude (degree: E+, W-)"]);
      const pieces = parseFloat(r["Level 3p (pieces/km2)"] || "0");
      const yearNum = parseFloat(r["year"] || "2025"); // Assign default year if missing

      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (yearNum < minYear) minYear = yearNum;
      if (yearNum > maxYear) maxYear = yearNum;

      // Input: [lat, lon, year]
      inputs.push([lat, lon, yearNum]);
      // Label: [pieces]
      labels.push([pieces]);
    });

    setBoundingBox({ minLat, maxLat, minLon, maxLon, minYear, maxYear });

    // Debugging: Log inputs and labels
    console.log("Number of samples:", inputs.length);
    console.log("First input sample:", inputs[0]);
    console.log("First label sample:", labels[0]);

    if (inputs.length === 0 || labels.length === 0) {
      setTrainingStatus("No valid data available for training.");
      setIsTraining(false);
      return;
    }

    let xs, ys;
    try {
      xs = tf.tensor2d(inputs, [inputs.length, 3]);
      ys = tf.tensor2d(labels, [labels.length, 1]);
    } catch (error) {
      console.error("Error creating tensors:", error);
      setTrainingStatus("Error processing data for training.");
      setIsTraining(false);
      return;
    }

    // Define Model Architecture
    const newModel = tf.sequential();
    newModel.add(tf.layers.dense({ units: 32, activation: "relu", inputShape: [3] }));
    newModel.add(tf.layers.dense({ units: 16, activation: "relu" }));
    newModel.add(tf.layers.dense({ units: 1 }));

    newModel.compile({
      optimizer: tf.train.adam(),
      loss: "meanSquaredError",
    });

    setTrainingStatus("Training model (this may take a moment)...");

    try {
      await newModel.fit(xs, ys, {
        epochs: 30, // Adjust as needed
        batchSize: 64, // Adjust as needed
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            const progress = Math.round(((epoch + 1) / 30) * 100);
            setTrainingProgress(progress);
            setTrainingStatus(`Training model... Epoch ${epoch + 1}/30`);
            console.log(`Epoch ${epoch + 1}/30 completed`);
          },
          onTrainEnd: () => {
            setIsTraining(false);
            setTrainingProgress(100);
            setTrainingStatus("Training complete. Model saved. Select year, time increment, & tactic to see predictions.");
          },
          onError: (error) => {
            console.error("Training error:", error);
            setTrainingStatus("Error during training. Check console for details.");
            setIsTraining(false);
          },
        },
      });
    } catch (error) {
      console.error("Training exception:", error);
      setTrainingStatus("Exception during training. Check console for details.");
      setIsTraining(false);
    }

    xs.dispose();
    ys.dispose();

    // Save model to local storage
    try {
      await newModel.save("localstorage://microplastics-model");
      console.log("Model saved to local storage!");
    } catch (error) {
      console.error("Error saving model:", error);
      setTrainingStatus("Error saving the model. Check console for details.");
    }

    setModel(newModel);
    setYears(uniqueYears);

    if (uniqueYears.includes(2025)) {
      setSelectedYear(2025);
    } else if (uniqueYears.length > 0) {
      setSelectedYear(uniqueYears[0]);
    }
  }

  // Generate Predictions based on selections
  useEffect(() => {
    if (!model || !boundingBox || selectedYear === null) return;
    generatePredictions(model, boundingBox, selectedYear, timeIncrement, tactic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, boundingBox, selectedYear, timeIncrement, tactic]);

  async function generatePredictions(mlModel, box, year, timeInc, tacticVal) {
    setTrainingStatus(`Generating predictions for year ${year} + ${Math.round(timeInc * 12)} months with tactic '${tacticVal}'...`);
    setIsPredicting(true);
    setPredictionProgress(0);

    // Calculate target year with time increment
    const targetYear = parseFloat(year) + timeInc;

    // Define grid step (10 degrees for performance)
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

    // Prepare input tensor for all points at once for better performance
    const inputArray = [];
    lonPoints.forEach((lon) => {
      latPoints.forEach((lat) => {
        inputArray.push([lat, lon, targetYear]);
      });
    });

    // Calculate the number of months from timeIncrement (in years)
    const months = Math.round(timeInc * 12);
    console.log(`Time Increment: ${timeInc} years (${months} months)`);

    try {
      const inputTensor = tf.tensor2d(inputArray, [inputArray.length, 3]);
      const outputTensor = mlModel.predict(inputTensor);
      const outputData = await outputTensor.array();

      // Since predictions are done in batch, set prediction progress to 100% after completion
      setPredictionProgress(100);

      outputData.forEach((pred, idx) => {
        let val = pred[0];
        const lat = inputArray[idx][0];
        const lon = inputArray[idx][1];

        // Apply the chosen mitigation tactic with cumulative monthly reductions
        val = applyMitigation(val, tacticVal, lat, lon, months);

        preds.push({ lat, lon, predValue: val });
        if (val > tempMax) tempMax = val;
      });

      inputTensor.dispose();
      outputTensor.dispose();

      setHeatmapData(preds);
      setMaxVal(tempMax);
      setTrainingStatus(`AI heatmap for year ${year} + ${months} months with tactic '${tacticVal}' generated!`);
    } catch (error) {
      console.error("Prediction error:", error);
      setTrainingStatus("Error during prediction. Check console for details.");
    }

    setIsPredicting(false);
  }

  // Mitigation Logic with Monthly Reductions
  function applyMitigation(value, tacticVal, lat, lon, months) {
    if (value <= 0) return 0;

    let reductionPercentage = 0;

    switch (tacticVal) {
      case "coastal":
        // 20% reduction per month near coasts (lat or lon within ±15 degrees)
        if (Math.abs(lat) < 15 || Math.abs(lon) < 15) {
          reductionPercentage = 0.2;
        }
        break;
      case "openocean":
        // 30% reduction per month offshore (lat and lon outside ±15 degrees)
        if (Math.abs(lat) >= 15 && Math.abs(lon) >= 15) {
          reductionPercentage = 0.3;
        }
        break;
      case "globalban":
        // 50% reduction per month overall
        reductionPercentage = 0.5;
        break;
      case "river":
        // 40% reduction per month if lat is between -10 and 10
        if (lat >= -10 && lat <= 10) {
          reductionPercentage = 0.4;
        }
        break;
      case "none":
      default:
        reductionPercentage = 0;
        break;
    }

    if (reductionPercentage > 0 && months > 0) {
      const cumulativeReductionFactor = Math.pow(1 - reductionPercentage, months);
      return value * cumulativeReductionFactor;
    }

    return value;
  }

  // Define color scale using d3
  const colorScale = useMemo(() => {
    return d3
      .scaleSequential()
      .domain([0, maxVal])
      .interpolator(interpolateYlOrRd);
  }, [maxVal]);

  return (
    <div className="bg-white p-6 rounded shadow mt-6">
      <h2 className="text-2xl font-semibold mb-4">AI Year Heatmap + Mitigation</h2>
      <p className="text-gray-600 mb-6">{trainingStatus}</p>

      {/* Selection Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:space-x-6 space-y-4 md:space-y-0 mb-8">
        {/* Year Dropdown */}
        {years.length > 0 && (
          <div className="flex items-center space-x-2">
            <label className="font-medium">Select Year:</label>
            <select
              className="border border-gray-300 rounded p-2"
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

        {/* Time Increment Dropdown */}
        <div className="flex items-center space-x-2">
          <label className="font-medium">Time Increment:</label>
          <select
            className="border border-gray-300 rounded p-2"
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

        {/* Mitigation Tactic Dropdown */}
        <div className="flex items-center space-x-2">
          <label className="font-medium">Mitigation Tactic:</label>
          <select
            className="border border-gray-300 rounded p-2"
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
        {/* Training Progress */}
        {isTraining && (
          <div>
            <p className="text-gray-700 mb-1">Training Progress:</p>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full"
                style={{ width: `${trainingProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-700 mt-1">{trainingProgress}%</p>
          </div>
        )}

        {/* Prediction Progress */}
        {isPredicting && (
          <div>
            <p className="text-gray-700 mb-1">Prediction Progress:</p>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-600 h-4 rounded-full"
                style={{ width: `${predictionProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-700 mt-1">{predictionProgress}%</p>
          </div>
        )}
      </div>

      {/* Heatmap Display */}
      {model && boundingBox && heatmapData.length > 0 ? (
        <div className="h-[500px] w-full">
          <MapContainer
            center={[0, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
            maxBounds={[[-90, -180], [90, 180]]}
            maxBoundsViscosity={1.0}
            worldCopyJump={false}
          >
            <TileLayer
              attribution='Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              noWrap={true}
            />
            {heatmapData.map((point, i) => {
              const lat = point.lat;
              const lon = point.lon;
              const val = point.predValue;
              if (val <= 0) return null;

              const color = colorScale(val);
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
                      <strong>Lat:</strong> {lat}, <strong>Lon:</strong> {lon}
                      <br />
                      <strong>Year:</strong> {selectedYear}
                      <br />
                      <strong>Time Increment:</strong> {Math.round(timeIncrement * 12)} months
                      <br />
                      <strong>Mitigation:</strong> {tactic}
                      <br />
                      <strong>Predicted:</strong> {val.toFixed(1)}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      ) : (
        <p className="text-gray-700">Waiting for training/predictions...</p>
      )}
    </div>
  );
}

export default AIYearHeatmapMitigation;
