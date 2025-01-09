// src/components/AIPredictions.jsx
import React, { useEffect, useState, useMemo } from "react";
import Papa from "papaparse";
import * as tf from "@tensorflow/tfjs";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ClipLoader } from "react-spinners";

function AIPredictions() {
  const [trainingStatus, setTrainingStatus] = useState("Loading data...");
  const [model, setModel] = useState(null);
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");
  const [predictionOutput, setPredictionOutput] = useState(null);
  const [trainingLoss, setTrainingLoss] = useState([]);
  const [error, setError] = useState(null);
  const [mapPosition, setMapPosition] = useState(null);

  useEffect(() => {
    // Attempt to load the model from local storage
    const loadModel = async () => {
      try {
        const savedModel = await tf.loadLayersModel("localstorage://microplastics-model");
        setModel(savedModel);
        setTrainingStatus("Model loaded from local storage.");
      } catch (err) {
        console.log("No saved model found. Parsing CSV and training a new model.");
        parseAndTrain();
      }
    };

    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseAndTrain = () => {
    Papa.parse("/Level3R1.csv", {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: (chunk) => {
        // Remove lines referencing '-9999: No data'
        const lines = chunk.split(/\r\n|\n|\r/);
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes("-9999: No data")) {
            lines.splice(i, 1);
          }
        }
        return lines.join("\n");
      },
      complete: (results) => {
        const cleaned = results.data.filter((r) => {
          const lat = parseFloat(r["latitude (degree: N+, S-)"] || "");
          const lon = parseFloat(r["longitude (degree: E+, W-)"] || "");
          const pieces = parseFloat(r["Level 3p (pieces/km2)"] || "0");
          if (isNaN(lat) || isNaN(lon) || isNaN(pieces)) return false;
          if (lat === -9999 || lon === -9999 || pieces === -9999) return false;
          return true;
        });

        if (cleaned.length === 0) {
          setError("No valid data available for training.");
          setTrainingStatus("Error: No valid data found.");
          return;
        }

        trainModel(cleaned);
      },
      error: (err) => {
        console.error("CSV Parsing Error:", err);
        setError("Failed to load data. Please try again later.");
        setTrainingStatus("Error loading data.");
      },
    });
  };

  async function trainModel(rows) {
    try {
      setTrainingStatus("Preparing data for training...");

      const inputs = [];
      const labels = [];

      rows.forEach((r) => {
        const lat = parseFloat(r["latitude (degree: N+, S-)"]);
        const lon = parseFloat(r["longitude (degree: E+, W-)"]);
        const pieces = parseFloat(r["Level 3p (pieces/km2)"] || "0");
        inputs.push([lat, lon]);
        labels.push([pieces]);
      });

      const xs = tf.tensor2d(inputs);
      const ys = tf.tensor2d(labels);

      // Define Model Architecture
      const newModel = tf.sequential();
      newModel.add(
        tf.layers.dense({
          units: 32,
          activation: "relu",
          inputShape: [2],
        })
      );
      newModel.add(tf.layers.dense({ units: 16, activation: "relu" }));
      newModel.add(tf.layers.dense({ units: 1 }));

      newModel.compile({
        optimizer: tf.train.adam(),
        loss: "meanSquaredError",
        metrics: ["mse"],
      });

      setTrainingStatus("Training model...");

      const history = await newModel.fit(xs, ys, {
        epochs: 50,
        batchSize: 32,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            setTrainingStatus(`Training... Epoch ${epoch + 1}/50`);
            setTrainingLoss((prev) => [...prev, logs.loss.toFixed(4)]);
          },
          onTrainEnd: async () => {
            setTrainingStatus("Training complete!");
            setModel(newModel);
            // Save the trained model to local storage
            await newModel.save("localstorage://microplastics-model");
            console.log("Model saved to local storage.");
          },
          onError: (err) => {
            console.error("Training Error:", err);
            setError("An error occurred during model training.");
            setTrainingStatus("Error during training.");
          },
        },
      });

      xs.dispose();
      ys.dispose();
    } catch (err) {
      console.error("Model Training Exception:", err);
      setError("An unexpected error occurred during training.");
      setTrainingStatus("Error during training.");
    }
  }

  function handlePredict(e) {
    e.preventDefault();
    if (!model) {
      alert("Model not ready yet!");
      return;
    }

    const latVal = parseFloat(latInput);
    const lonVal = parseFloat(lonInput);

    // Input Validation
    if (
      isNaN(latVal) ||
      isNaN(lonVal) ||
      latVal < -90 ||
      latVal > 90 ||
      lonVal < -180 ||
      lonVal > 180
    ) {
      alert("Please enter valid latitude (-90 to 90) and longitude (-180 to 180) values.");
      return;
    }

    try {
      const inputTensor = tf.tensor2d([[latVal, lonVal]]);
      const outputTensor = model.predict(inputTensor);
      const predictedValue = outputTensor.dataSync()[0];
      setPredictionOutput(predictedValue.toFixed(2));
      setMapPosition([latVal, lonVal]);

      inputTensor.dispose();
      outputTensor.dispose();
    } catch (err) {
      console.error("Prediction Error:", err);
      setError("An error occurred during prediction.");
    }
  }

  // Define color scale using d3
  const colorScale = useMemo(() => {
    if (trainingLoss.length === 0) return (val) => "#ff0000"; // Default color
    const maxLoss = Math.max(...trainingLoss);
    return d3
      .scaleSequential()
      .domain([0, maxLoss])
      .interpolator(d3.interpolateYlOrRd);
  }, [trainingLoss]);

  return (
    <div className="bg-white p-8 rounded shadow mt-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4 text-blue-700">AI/ML Microplastics Predictions</h2>

      {/* Status Section */}
      <div className="mb-6">
        {error ? (
          <div className="bg-red-100 text-red-700 p-4 rounded">
            <p>{error}</p>
          </div>
        ) : (
          <div className="bg-blue-100 text-blue-700 p-4 rounded flex items-center">
            <div className="flex-1">
              <p>Status: <strong>{trainingStatus}</strong></p>
              {trainingLoss.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm">Latest Training Loss: <strong>{trainingLoss[trainingLoss.length - 1]}</strong></p>
                </div>
              )}
            </div>
            {/* Optional Spinner */}
            {!model && trainingStatus !== "Error: No valid data found." && !error && (
              <ClipLoader color="#1d4ed8" size={24} />
            )}
          </div>
        )}
      </div>

      {/* Training Progress Chart */}
      {trainingLoss.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2 text-gray-700">Training Progress</h3>
          <div className="w-full h-40">
            <svg width="100%" height="100%">
              <polyline
                fill="none"
                stroke="blue"
                strokeWidth="2"
                points={trainingLoss
                  .map((loss, idx) => {
                    const x = (idx / (trainingLoss.length - 1)) * 100;
                    const y = 100 - (loss / Math.max(...trainingLoss)) * 100;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
            </svg>
          </div>
        </div>
      )}

      {/* Prediction Form */}
      <form onSubmit={handlePredict} className="mb-6">
        <h3 className="text-xl font-medium mb-4 text-blue-600">Make a Prediction</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Latitude Input */}
          <div>
            <label htmlFor="latitude" className="block text-sm font-medium text-gray-700 mb-1">
              Latitude <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="latitude"
              name="latitude"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              placeholder="e.g., 34.0522"
              required
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="-90"
              max="90"
              step="any"
            />
            <small className="text-xs text-gray-500">Enter a value between -90 and 90.</small>
          </div>

          {/* Longitude Input */}
          <div>
            <label htmlFor="longitude" className="block text-sm font-medium text-gray-700 mb-1">
              Longitude <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="longitude"
              name="longitude"
              value={lonInput}
              onChange={(e) => setLonInput(e.target.value)}
              placeholder="e.g., -118.2437"
              required
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="-180"
              max="180"
              step="any"
            />
            <small className="text-xs text-gray-500">Enter a value between -180 and 180.</small>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="mt-4 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition duration-300 w-full md:w-auto"
        >
          Predict Microplastic Concentration
        </button>
      </form>

      {/* Prediction Output */}
      {predictionOutput !== null && (
        <div className="bg-green-100 text-green-700 p-4 rounded mb-6">
          <p>
            Predicted Microplastic Pieces per km²: <strong>{predictionOutput}</strong>
          </p>
        </div>
      )}

      {/* Interactive Map */}
      {mapPosition && (
        <div className="h-96 w-full rounded-lg shadow-lg">
          <MapContainer
            center={mapPosition}
            zoom={10}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CircleMarker
              center={mapPosition}
              radius={10}
              pathOptions={{ color: "green", fillColor: "green", fillOpacity: 0.5 }}
            >
              <Tooltip>
                <div>
                  <strong>Latitude:</strong> {latInput}<br />
                  <strong>Longitude:</strong> {lonInput}<br />
                  <strong>Predicted Pieces:</strong> {predictionOutput}
                </div>
              </Tooltip>
            </CircleMarker>
          </MapContainer>
        </div>
      )}
    </div>
  );
}

export default AIPredictions;
