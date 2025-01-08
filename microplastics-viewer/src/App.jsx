import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import Level012Table from './components/Level012Table'
import Level3Map from './components/Level3Map'
import Level3pmMonthly from './components/Level3pmMonthly'
import Level3wmMonthly from './components/Level3wmMonthly'
import TimeLapseMonthly from './components/TimeLapseMonthly'
import MitigationSim from './components/MitigationSim'
import MicroplasticsNodeGraph3D from './components/MicroplasticsNodeGraph3D'
import AIPredictions from './components/AIPredictions'
import AIYearHeatmapMitigation from './components/AIYearHeatmapMitigation'

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <div className="p-4">
        <Routes>
          <Route
            path="/"
            element={
              <div className="bg-white p-6 rounded shadow">
                <h1 className="text-4xl font-bold mb-4 text-center text-blue-700">
                  Microplastics Viewer
                </h1>
                <p className="text-lg text-gray-700 leading-relaxed mb-4">
                  Explore global microplastic data through heatmaps, monthly distributions, 3D node graphs, and more.
                </p>
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/2/21/Plastic_pollution_in_microscope.jpg"
                  alt="Microplastics"
                  className="mx-auto w-1/2 rounded shadow"
                />
              </div>
            }
          />
          <Route path="/level012" element={<Level012Table />} />
          <Route path="/level3" element={<Level3Map />} />
          <Route path="/level3pm" element={<Level3pmMonthly />} />
          <Route path="/level3wm" element={<Level3wmMonthly />} />
          <Route path="/timelapse" element={<TimeLapseMonthly />} />
          <Route path="/mitigation" element={<MitigationSim />} />
          <Route path="/nodegraph3d" element={<MicroplasticsNodeGraph3D />} />
          <Route path="/aipredictions" element={<AIPredictions />} />
          <Route path="/ai-year-mitigation" element={<AIYearHeatmapMitigation />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
