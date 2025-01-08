import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import * as tf from "@tensorflow/tfjs";

function AIPredictions() {
  const [trainingStatus, setTrainingStatus] = useState("Not started");
  const [model, setModel] = useState(null);
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");
  const [predictionOutput, setPredictionOutput] = useState(null);

  useEffect(() => {
    // 1) Parse CSV
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
        // 2) Filter out rows with -9999 coords or microplastics
        const cleaned = results.data.filter((r) => {
          const lat = parseFloat(r["latitude (degree: N+, S-)"] || "");
          const lon = parseFloat(r["longitude (degree: E+, W-)"] || "");
          const pieces = parseFloat(r["Level 3p (pieces/km2)"] || "0");
          if (isNaN(lat) || isNaN(lon) || isNaN(pieces)) return false;
          if (lat === -9999 || lon === -9999 || pieces === -9999) return false;
          return true;
        });

        trainModel(cleaned);
      },
    });
  }, []);

  async function trainModel(rows) {
    setTrainingStatus("Preparing data...");

    // We'll do a simple lat/lon => pieces model
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

    // Basic sequential model
    const newModel = tf.sequential();
    newModel.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [2] }));
    newModel.add(tf.layers.dense({ units: 1 })); // output 1 value

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

    setTrainingStatus("Training complete!");
    setModel(newModel);

    xs.dispose();
    ys.dispose();
  }

  function handlePredict() {
    if (!model) {
      alert("Model not ready yet!");
      return;
    }
    const latVal = parseFloat(latInput) || 0;
    const lonVal = parseFloat(lonInput) || 0;

    const inputTensor = tf.tensor2d([[latVal, lonVal]]);
    const outputTensor = model.predict(inputTensor);
    const predictedValue = outputTensor.dataSync()[0];
    setPredictionOutput(predictedValue.toFixed(2));

    inputTensor.dispose();
    outputTensor.dispose();
  }

  return (
    <div className="bg-white p-4 rounded shadow mt-4">
      <h2 className="text-xl font-semibold mb-2">AI/ML Predictions</h2>
      <p className="text-sm text-gray-600 mb-2">
        We train a TF.js model that uses lat/lon to predict microplastic concentration (pieces).
      </p>
      <p className="text-sm text-gray-800 mb-2">
        Status: <strong>{trainingStatus}</strong>
      </p>

      {model && (
        <div className="border p-3 rounded">
          <h3 className="text-md font-semibold mb-2 text-blue-600">Try a Prediction</h3>
          <div className="flex items-center space-x-4 mb-2">
            <div>
              <label className="block text-sm font-medium">Latitude</label>
              <input
                type="number"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="border rounded p-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Longitude</label>
              <input
                type="number"
                value={lonInput}
                onChange={(e) => setLonInput(e.target.value)}
                className="border rounded p-1"
              />
            </div>
          </div>

          <button
            onClick={handlePredict}
            className="bg-green-500 text-white px-3 py-1 rounded"
          >
            Predict
          </button>

          {predictionOutput !== null && (
            <p className="mt-2 text-sm text-gray-700">
              Predicted Microplastic Pieces: <strong>{predictionOutput}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default AIPredictions;
