import React, { useEffect, useState, useRef } from 'react'
import Papa from 'papaparse'
import { ForceGraph3D } from 'react-force-graph'
import * as THREE from 'three'

// 1) Approx bounding logic for major countries/regions
function getClosestCountry(lat, lon) {
  // USA
  if (lat >= 25 && lat <= 49 && lon >= -125 && lon <= -66) return "USA"
  // Canada
  if (lat >= 50 && lat <= 70 && lon >= -140 && lon <= -50) return "Canada"
  // Brazil
  if (lat >= -34 && lat <= 5 && lon >= -74 && lon <= -34) return "Brazil"
  // Australia
  if (lat >= -44 && lat <= -10 && lon >= 113 && lon <= 154) return "Australia"
  // Russia
  if (lat >= 41 && lat <= 77 && lon >= 30 && lon <= 180) return "Russia"
  // China
  if (lat >= 18 && lat <= 53 && lon >= 73 && lon <= 135) return "China"
  // India
  if (lat >= 6 && lat <= 35 && lon >= 68 && lon <= 97) return "India"
  // EU bounding box (very rough)
  if (lat >= 35 && lat <= 71 && lon >= -10 && lon <= 40) return "EU"
  // Africa
  if (lat >= -35 && lat <= 37 && lon >= -17 && lon <= 51) return "Africa"

  return "Other"
}

// 2) Pre-chosen 3D centers for each region
const countryCenters = {
  "USA": [0, 0, 0],
  "Canada": [80, 60, 0],
  "Brazil": [-80, -40, 0],
  "Australia": [50, -100, 50],
  "Russia": [0, 100, -50],
  "China": [120, 10, 80],
  "India": [100, -60, 80],
  "EU": [-120, 20, 50],
  "Africa": [-20, -80, 0],
  "Other": [0, 120, 0],
}

function MicroplasticsNodeGraph3D() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  // Whether all nodes are pinned by country
  const [groupedByCountry, setGroupedByCountry] = useState(false)
  // Which country has been "expanded" (unpinned), if any
  const [expandedCountry, setExpandedCountry] = useState(null)

  // Store raw graph structure so we can re-apply pinned/unpinned logic
  const rawDataRef = useRef(null)

  // --- 3) Load & parse CSV ---
  useEffect(() => {
    Papa.parse('/Level3R1.csv', {
      download: true,
      skipEmptyLines: true,
      header: true,
      beforeFirstChunk: chunk => {
        // remove lines referencing '-9999: No data'
        const lines = chunk.split(/\r\n|\n|\r/)
        if (lines[1]?.includes('-9999: No data')) {
          lines.splice(1,1)
        }
        return lines.join('\n')
      },
      complete: (results) => {
        // filter lat/lon
        const cleaned = results.data.filter(row => {
          const lat = parseFloat(row["latitude (degree: N+, S-)"] || "")
          const lon = parseFloat(row["longitude (degree: E+, W-)"] || "")
          if (isNaN(lat) || isNaN(lon)) return false
          if (lat === -9999 || lon === -9999) return false
          return true
        })

        // Create a node for each row
        const nodes = cleaned.map((row, i) => {
          const lat = parseFloat(row["latitude (degree: N+, S-)"])
          const lon = parseFloat(row["longitude (degree: E+, W-)"])
          const pieces = parseFloat(row["Level 3p (pieces/km2)"] || 0)
          const country = getClosestCountry(lat, lon)
          return {
            id: `node-${i}`,
            lat, lon,
            pieces,
            country,
            val: Math.log10(pieces + 1),
          }
        })

        // Link each node to some random node in the same country
        const links = []
        const countryMap = {}
        nodes.forEach(n => {
          if (!countryMap[n.country]) countryMap[n.country] = []
          countryMap[n.country].push(n.id)
        })

        nodes.forEach(n => {
          const cNodes = countryMap[n.country]
          if (cNodes.length > 1) {
            let randomId = cNodes[Math.floor(Math.random() * cNodes.length)]
            if (randomId === n.id && cNodes.length > 1) {
              randomId = cNodes[Math.floor(Math.random() * cNodes.length)]
            }
            if (randomId !== n.id) {
              links.push({ source: n.id, target: randomId })
            }
          }
        })

        const graph = { nodes, links }
        rawDataRef.current = graph
        setGraphData(graph)
      },
    })
  }, [])

  // --- 4) Re-apply pinned logic whenever groupedByCountry or expandedCountry changes ---
  useEffect(() => {
    if (!rawDataRef.current) return
    const old = rawDataRef.current

    // We'll map over nodes, setting fx, fy, fz if pinned
    const newNodes = old.nodes.map(n => {
      if (!groupedByCountry) {
        // not grouped => everything unpinned
        return { ...n, fx: undefined, fy: undefined, fz: undefined }
      } else {
        // grouped by country => pinned to country center
        const center = countryCenters[n.country] || [0,0,0]
        // if this country is expanded => unpin them
        if (expandedCountry && n.country === expandedCountry) {
          return { ...n, fx: undefined, fy: undefined, fz: undefined }
        } else {
          return { ...n, fx: center[0], fy: center[1], fz: center[2] }
        }
      }
    })

    setGraphData({
      nodes: newNodes,
      links: old.links
    })
  }, [groupedByCountry, expandedCountry])

  // --- 5) Node click => if grouped and not expanded, expand that node's country
  const handleNodeClick = (node) => {
    if (groupedByCountry) {
      // If we already have an expandedCountry, and we click the same => do nothing
      // Or if we click a different => expand that new one
      if (expandedCountry === node.country) {
        // do nothing or further custom logic
      } else {
        setExpandedCountry(node.country)
      }
    }
  }

  // --- 6) Reassemble everything => set expandedCountry = null
  const handleReassemble = () => {
    setExpandedCountry(null)
  }

  return (
    <div className="relative bg-gradient-to-br from-blue-50 to-green-50 p-6 rounded-lg shadow-lg mt-4">
      <h2 className="text-xl font-semibold mb-2 text-gray-700">
        3D Microplastics Node Graph by Country
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        All rows are nodes, color-coded by country. Toggle &quot;Group by Country&quot; to pin nodes.
        Click a node to &quot;break off&quot; that entire country's nodes. Press &quot;Reassemble&quot; to pin them again.
      </p>

      <div className="flex items-center space-x-3 mb-4">
        <button
          onClick={() => setGroupedByCountry(g => !g)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow"
        >
          {groupedByCountry ? "Ungroup" : "Group by Country"}
        </button>
        {groupedByCountry && expandedCountry && (
          <button
            onClick={handleReassemble}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow"
          >
            Reassemble
          </button>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg" style={{ height: '600px' }}>
        <ForceGraph3D
          graphData={graphData}
          //
          // Use HTML in the nodeLabel to enforce black text on hover:
          //
          nodeLabel={node => `
            <div style="color: black;">
              <strong>Country:</strong> ${node.country}<br/>
              <strong>Lat:</strong> ${node.lat}, 
              <strong>Lon:</strong> ${node.lon}<br/>
              <strong>Pieces:</strong> ${node.pieces}
            </div>
          `}
          nodeAutoColorBy="country"
          nodeVal={node => node.val}
          // Increase nodeRelSize for bigger label sprites
          nodeRelSize={6}
          // Adjust link styles
          linkWidth={1}
          linkColor={() => '#999'}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={() => 0.002}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => '#555'}
          // Softer background color
          backgroundColor="#f0f0f0"
          // Camera and interaction settings
          showNavInfo={true}
          enableNodeDrag={true}
          onNodeClick={handleNodeClick}
          cameraAutoFit={true}
        />
      </div>
    </div>
  )
}

export default MicroplasticsNodeGraph3D
