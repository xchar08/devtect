// src/components/AIYearHeatmapMitigation.jsx
import React, { useEffect, useState, useMemo } from "react";
import Papa from "papaparse";
import * as tf from "@tensorflow/tfjs";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
// Removed MarkerClusterGroup imports
// import MarkerClusterGroup from "@changey/react-leaflet-markercluster";
// import "@changey/react-leaflet-markercluster/dist/styles.min.css";
import * as d3 from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";
import { ClipLoader } from "react-spinners";

// Fix Leaflet's default icon paths
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

// Define time increments as a constant outside the component
const timeIncrements = [
  { label: "6 Months", value: 0.5 },
  { label: "1 Year", value: 1 },
  { label: "2 Years", value: 2 },
  { label: "5 Years", value: 5 },
  { label: "10 Years", value: 10 },
];

// Mitigation Strategies
const tactics = [
  { 
    label: "No Mitigation", 
    value: "none", 
    description: "No actions taken to reduce microplastics.", 
    type: "none", 
    rate: 0,
    applies: () => true // Always applies
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
  // Additional Mitigation Strategies
  { 
    label: "Biodegradable Plastics Promotion (-25% overall)", 
    value: "biodegradable", 
    description: "Encourages the use of biodegradable plastics, reducing microplastics by 25% globally.", 
    type: "oneTime", 
    rate: 0.25,
    applies: () => true
  },
  { 
    label: "Industrial Filtration Systems (-35% near industrial areas)", 
    value: "industrial", 
    description: "Implements filtration systems in industrial zones, reducing microplastics by 35% in these areas.", 
    type: "perYear", 
    rate: 0.35,
    applies: (lat, lon) => Math.abs(lat) < 30 && Math.abs(lon) < 30
  },
  { 
    label: "Public Awareness Campaigns (-15% overall)", 
    value: "awareness", 
    description: "Increases public awareness leading to a 15% reduction in microplastics globally.", 
    type: "oneTime", 
    rate: 0.15,
    applies: () => true
  },
  { 
    label: "Advanced Waste Management (-40% in urban areas)", 
    value: "wastemanagement", 
    description: "Enhances waste management practices in urban regions, reducing microplastics by 40% in these areas.", 
    type: "perYear", 
    rate: 0.4,
    applies: (lat, lon) => Math.abs(lat) <= 45 && Math.abs(lon) <= 45
  },
  { 
    label: "Legislation on Plastic Production (-30% globally)", 
    value: "legislation", 
    description: "Imposes strict regulations on plastic production, reducing microplastics by 30% globally.", 
    type: "oneTime", 
    rate: 0.3,
    applies: () => true
  },
  { 
    label: "Ocean Restoration Projects (-20% globally)", 
    value: "oceanrestoration", 
    description: "Undertakes ocean restoration projects, reducing microplastics by 20% globally.", 
    type: "oneTime", 
    rate: 0.2,
    applies: () => true
  },
  { 
    label: "Erosion Control Measures (-25% in vulnerable areas)", 
    value: "erosioncontrol", 
    description: "Implements erosion control measures in vulnerable areas, reducing microplastics by 25%.", 
    type: "perYear", 
    rate: 0.25,
    applies: (lat, lon) => lat >= -20 && lat <= 20
  },
];

// Define model version to manage different model architectures
const MODEL_VERSION = "v2"; // Increment this when the model architecture changes
const MODEL_URL = `localstorage://microplastics-model-${MODEL_VERSION}`;

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
        // Attempt to load the model
        const loadedModel = await tf.loadLayersModel(MODEL_URL);
        console.log(`Model loaded from local storage (${MODEL_URL})!`);
        setModel(loadedModel);
        parseCsv(false);
      } catch (err) {
        console.log(`No saved model found at ${MODEL_URL} or error loading. Training now...`);
        // If model loading fails, attempt to remove any existing older model
        try {
          const olderModelURL = `localstorage://microplastics-model-${MODEL_VERSION}`;
          await tf.io.removeModel(olderModelURL);
          console.log(`Existing model (${olderModelURL}) removed from local storage.`);
        } catch (removeError) {
          console.warn("No existing model to remove or error removing model:", removeError);
        }
        // Proceed to parse CSV and train a new model
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
      console.log("Input tensor shape:", xs.shape);
      console.log("Label tensor shape:", ys.shape);
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

    setTrainingStatus("Training model...");

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
          onTrainEnd: async () => {
            setIsTraining(false);
            setTrainingProgress(100);
            setTrainingStatus("Training complete. Model saved. Select year, time increment, & tactic to see predictions.");
            // Save model to local storage with versioning
            try {
              await newModel.save(MODEL_URL);
              console.log(`Model saved to local storage (${MODEL_URL})!`);
            } catch (error) {
              console.error("Error saving model:", error);
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
      console.error("Training exception:", error);
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

  // Generate Predictions based on selections
  useEffect(() => {
    if (!model || !boundingBox || selectedYear === null) return;
    generatePredictions(model, boundingBox, selectedYear, timeIncrement, tactic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, boundingBox, selectedYear, timeIncrement, tactic]);

  async function generatePredictions(mlModel, box, year, timeInc, tacticVal) {
    setTrainingStatus(`Generating predictions for year ${year} + ${Math.round(timeInc * 12)} months with tactic '${getTacticLabel(tacticVal)}'...`);
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

    // Calculate the number of full years from timeIncrement
    const years = Math.floor(timeInc);
    console.log(`Time Increment: ${timeInc} years (Full Years: ${years})`);

    try {
      const inputTensor = tf.tensor2d(inputArray, [inputArray.length, 3]);
      console.log("Prediction input tensor shape:", inputTensor.shape);
      const outputTensor = mlModel.predict(inputTensor);
      const outputData = await outputTensor.array();

      // Since predictions are done in batch, set prediction progress to 100% after completion
      setPredictionProgress(100);

      outputData.forEach((pred, idx) => {
        let val = pred[0];
        const lat = inputArray[idx][0];
        const lon = inputArray[idx][1];

        // Apply the chosen mitigation tactic with the correct reduction logic
        val = applyMitigationStrategy(val, tacticVal, lat, lon, years);

        preds.push({ lat, lon, predVal: val });
        if (val > tempMax) tempMax = val;
      });

      inputTensor.dispose();
      outputTensor.dispose();

      setHeatmapData(preds);
      setMaxVal(tempMax);
      setTrainingStatus(`AI heatmap for year ${year} + ${Math.round(timeInc * 12)} months with tactic '${getTacticLabel(tacticVal)}' generated!`);
    } catch (error) {
      console.error("Prediction error:", error);
      setTrainingStatus("Error during prediction. Check console for details.");
    }

    setIsPredicting(false);
  }

  // Mitigation Logic with Correct Reduction Application
  function applyMitigationStrategy(value, tacticVal, lat, lon, years) {
    const selectedTactic = tactics.find(t => t.value === tacticVal);
    if (!selectedTactic) return value;

    // Check if the tactic applies to the given location
    if (!selectedTactic.applies(lat, lon)) return value;

    let finalValue = value;

    if (selectedTactic.type === "perYear") {
      // Use only full years for reductions
      const fullYears = Math.floor(years);
      finalValue = value * Math.pow(1 - selectedTactic.rate, fullYears);
      console.log(`Applying per-year reduction: Original Value = ${value}, Rate = ${selectedTactic.rate}, Years = ${fullYears}, Final Value = ${finalValue}`);
    } else if (selectedTactic.type === "oneTime") {
      // One-time reduction: value * (1 - rate)
      finalValue = value * (1 - selectedTactic.rate);
      console.log(`Applying one-time reduction: Original Value = ${value}, Rate = ${selectedTactic.rate}, Final Value = ${finalValue}`);
    }
    // 'none' type or unrecognized type returns the original value

    // Ensure the value doesn't go below zero
    return Math.max(finalValue, 0);
  }

  // Get Tactic Label by Value
  function getTacticLabel(value) {
    const tactic = tactics.find(t => t.value === value);
    return tactic ? tactic.label : "Unknown";
  }

  // Define color scale using d3
  const colorScale = useMemo(() => {
    return d3
      .scaleSequential()
      .domain([0, maxVal])
      .interpolator(interpolateYlOrRd);
  }, [maxVal]);

  return (
    <div className="bg-white p-8 rounded shadow mt-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-4 text-blue-700">AI Year Heatmap + Mitigation Strategies</h2>
      <p className="text-gray-600 mb-6">
        Utilize our AI-driven models to predict future microplastic pollution scenarios based on various mitigation strategies. Select a year, time increment, and mitigation tactic to visualize the projected impacts.
      </p>

      {/* Selection Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:space-x-6 space-y-4 md:space-y-0 mb-8">
        {/* Year Dropdown */}
        {years.length > 0 && (
          <div className="flex flex-col">
            <label htmlFor="year" className="font-medium mb-1">Select Year:</label>
            <select
              id="year"
              className="border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="flex flex-col">
          <label htmlFor="timeIncrement" className="font-medium mb-1">Time Increment:</label>
          <select
            id="timeIncrement"
            className="border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="flex flex-col">
          <label htmlFor="tactic" className="font-medium mb-1">Mitigation Tactic:</label>
          <select
            id="tactic"
            className="border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {/* Prediction Progress */}
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
        <div className="h-[600px] w-full rounded-lg shadow-lg">
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
            {/* Removed MarkerClusterGroup */}
            {/* <MarkerClusterGroup> */}
              {heatmapData.map((point, i) => {
                const lat = point.lat;
                const lon = point.lon;
                const val = point.predVal;
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
                      fillOpacity: 0.8,
                    }}
                  >
                    <Tooltip>
                      <div>
                        <strong>Lat:</strong> {lat}, <strong>Lon:</strong> {lon}
                        <br />
                        <strong>Year:</strong> {selectedYear + Math.floor(timeIncrement)}
                        <br />
                        <strong>Mitigation:</strong> {getTacticLabel(tactic)}
                        <br />
                        <strong>Predicted:</strong> {val.toFixed(1)} pieces/km²
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            {/* </MarkerClusterGroup> */}
          </MapContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[600px] w-full rounded-lg shadow-lg bg-gray-100">
          <p className="text-gray-700">Waiting for training/predictions...</p>
        </div>
      )}
    </div>
  );
}

export default AIYearHeatmapMitigation;
