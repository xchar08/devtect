import React from 'react'
import { Link } from 'react-router-dom'

function Navigation() {
  return (
    <nav className="p-4 bg-blue-50 shadow flex items-center space-x-4">
      <Link to="/" className="text-blue-700 hover:underline font-semibold">Home</Link>
      <Link to="/level3" className="text-blue-700 hover:underline">Level3</Link>
      <Link to="/mitigation" className="text-blue-700 hover:underline">Mitigation</Link>
      <Link to="/nodegraph3d" className="text-blue-700 hover:underline">NodeGraph3D</Link>
      <Link to="/aipredictions" className="text-blue-700 hover:underline">AIPredictions</Link>
      <Link to="/ai-year-mitigation" className="text-blue-700 hover:underline">AIYearHeatmapMitigation</Link>
    </nav>
  )
}

export default Navigation
