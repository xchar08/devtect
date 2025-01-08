import React, { useEffect, useState } from 'react'
import Papa from 'papaparse'

function Level012Table() {
  const [tableData, setTableData] = useState([])

  useEffect(() => {
    Papa.parse('/Level012R1.csv', {
      download: true,
      skipEmptyLines: true,
      // Remove any extra lines if the first line references "-999: No data"
      beforeFirstChunk: (chunk) => {
        const lines = chunk.split(/\r\n|\n|\r/)
        if (lines.length && lines[1]?.includes('-999: No data')) {
          // e.g. remove that line
          lines.splice(1,1)
        }
        return lines.join('\n')
      },
      header: true,
      complete: (results) => {
        // filter out -9999 or empty rows if needed
        const cleaned = results.data.filter((row) => {
          if (!row.year) return false
          // can add more checks if row["longitude (degree: E+, W-)"] = -9999...
          return true
        })
        setTableData(cleaned)
      },
    })
  }, [])

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-xl font-semibold mb-2">Level012R1 - Table</h2>
      {tableData.length > 0 ? (
        <div className="overflow-auto">
          <table className="table-auto w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                {Object.keys(tableData[0]).slice(0, 6).map((col) => (
                  <th key={col} className="border p-2 font-medium text-gray-700">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.slice(0, 20).map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {Object.keys(row).slice(0, 6).map((col) => (
                    <td key={col} className="border p-2">
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-2">
            Showing first 20 rows, first 6 columns
          </p>
        </div>
      ) : (
        <p>No data or loading...</p>
      )}
    </div>
  )
}

export default Level012Table
