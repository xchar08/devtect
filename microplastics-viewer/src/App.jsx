// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import Level3Map from './components/Level3Map';
import TimeLapseMonthly from './components/TimeLapseMonthly'; // Importing the component
import MitigationSim from './components/MitigationSim';
import MicroplasticsNodeGraph3D from './components/MicroplasticsNodeGraph3D';
import AIPredictions from './components/AIPredictions';
import AIYearHeatmapMitigation from './components/AIYearHeatmapMitigation';

// Importing images (ensure the path is correct)
import micro from './assets/images/micro.jpeg'; // Update the path if necessary

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <div className="p-4">
        <Routes>
          <Route
            path="/"
            element={
              <div className="space-y-12">
                {/* Hero Section */}
                <section className="bg-blue-100 p-8 rounded-lg shadow-md flex flex-col md:flex-row items-center">
                  <div className="md:w-1/2">
                    <h1 className="text-5xl font-bold text-blue-800 mb-4">
                      Discover the Impact of Microplastics
                    </h1>
                    <p className="text-lg text-gray-700 mb-6">
                      Our platform provides comprehensive insights into global microplastic pollution through interactive heatmaps, monthly distributions, 3D visualizations, and advanced AI predictions. Understand patterns, track changes over time, and explore effective mitigation strategies to combat this pressing environmental issue.
                    </p>
                    <a
                      href="/aipredictions"
                      className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full shadow hover:bg-blue-700 transition duration-300"
                    >
                      Get Started
                    </a>
                  </div>
                  <div className="md:w-1/2 mt-6 md:mt-0">
                    <img
                      src={micro} // Using the imported image
                      alt="Microplastics"
                      className="w-full h-auto rounded-lg shadow-lg"
                      loading="lazy" // Enables lazy loading for performance
                    />
                  </div>
                </section>

                {/* Features Section */}
                <section className="space-y-8">
                  <h2 className="text-3xl font-semibold text-center text-blue-700">
                    Features
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Feature 1 */}
                    <div className="flex flex-col items-center bg-white p-6 rounded-lg shadow hover:shadow-xl transition duration-300">
                      <div className="mb-4">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-12 w-12 text-blue-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c1.104 0 2 .896 2 2s-.896 2-2 2-2-.896-2-2 .896-2 2-2zM12 14c1.104 0 2 .896 2 2s-.896 2-2 2-2-.896-2-2 .896-2 2-2zM12 2c1.104 0 2 .896 2 2s-.896 2-2 2-2-.896-2-2 .896-2 2-2z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Interactive Heatmaps</h3>
                      <p className="text-gray-600 text-center">
                        Visualize global microplastic concentrations with dynamic heatmaps, allowing for easy identification of pollution hotspots and trends over time.
                      </p>
                    </div>

                    {/* Feature 2 */}
                    <div className="flex flex-col items-center bg-white p-6 rounded-lg shadow hover:shadow-xl transition duration-300">
                      <div className="mb-4">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-12 w-12 text-blue-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Monthly Distributions</h3>
                      <p className="text-gray-600 text-center">
                        Analyze microplastic levels on a monthly basis to track fluctuations, seasonal patterns, and the effectiveness of mitigation efforts.
                      </p>
                    </div>

                    {/* Feature 3 */}
                    <div className="flex flex-col items-center bg-white p-6 rounded-lg shadow hover:shadow-xl transition duration-300">
                      <div className="mb-4">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-12 w-12 text-blue-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold mb-2">3D Visualizations</h3>
                      <p className="text-gray-600 text-center">
                        Explore our 3D node graphs to understand the intricate relationships and distributions of microplastics across different regions.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Time Lapse Section */}
                <section className="space-y-8">
                  <TimeLapseMonthly /> {/* Embedding the TimeLapseMonthly component */}
                </section>

                {/* Optional Additional Sections */}
                {/* Add more sections like Testimonials, Statistics, etc., as needed */}
              </div>
            }
          />
          {/* Remove the separate /timelapse route */}
          {/* <Route path="/timelapse" element={<TimeLapseMonthly />} /> */}

          {/* Define other routes */}
          <Route path="/level3" element={<Level3Map />} />
          <Route path="/mitigation" element={<MitigationSim />} />
          <Route path="/nodegraph3d" element={<MicroplasticsNodeGraph3D />} />
          <Route path="/aipredictions" element={<AIPredictions />} />
          <Route path="/ai-year-mitigation" element={<AIYearHeatmapMitigation />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
