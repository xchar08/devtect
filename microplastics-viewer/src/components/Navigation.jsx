import React from 'react';
import { Link } from 'react-router-dom';

function Navigation() {
  return (
    <nav className="p-4 bg-blue-600 shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="text-white text-2xl font-bold">
          Devtect
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex space-x-6">
          <Link
            to="/"
            className="text-white hover:text-blue-200 transition duration-200 font-medium"
          >
            Home
          </Link>
          <Link
            to="/level3"
            className="text-white hover:text-blue-200 transition duration-200 font-medium"
          >
            Level3
          </Link>
          <Link
            to="/mitigation"
            className="text-white hover:text-blue-200 transition duration-200 font-medium"
          >
            Mitigation
          </Link>
          <Link
            to="/nodegraph3d"
            className="text-white hover:text-blue-200 transition duration-200 font-medium"
          >
            NodeGraph3D
          </Link>
          <Link
            to="/aipredictions"
            className="text-white hover:text-blue-200 transition duration-200 font-medium"
          >
            AI Predictions
          </Link>
          <Link
            to="/ai-year-mitigation"
            className="text-white hover:text-blue-200 transition duration-200 font-medium"
          >
            Yearly Heatmap
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            id="menu-btn"
            className="text-white focus:outline-none focus:ring-2 focus:ring-white rounded-md"
          >
            <svg
              className="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
