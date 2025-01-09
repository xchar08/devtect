// components/BackgroundParticles.js
import React from "react";

function BackgroundParticles() {
  const particles = Array.from({ length: 30 });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg
        className="absolute top-0 left-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 200 200"
      >
        {particles.map((_, index) => (
          <circle
            key={index}
            cx={Math.random() * 200}
            cy={Math.random() * 200}
            r={Math.random() * 2 + 1}
            fill="rgba(255, 255, 255, 0.2)"
            opacity={Math.random()}
          >
            <animate
              attributeName="cx"
              from={Math.random() * 200}
              to={Math.random() * 200}
              dur={`${Math.random() * 20 + 10}s`}
              repeatCount="indefinite"
              begin={`${Math.random() * 5}s`}
            />
            <animate
              attributeName="cy"
              from={Math.random() * 200}
              to={Math.random() * 200}
              dur={`${Math.random() * 20 + 10}s`}
              repeatCount="indefinite"
              begin={`${Math.random() * 5}s`}
            />
            <animate
              attributeName="opacity"
              from="0"
              to="1"
              dur={`${Math.random() * 5 + 5}s`}
              repeatCount="indefinite"
              begin={`${Math.random() * 5}s`}
            />
          </circle>
        ))}
      </svg>
    </div>
  );
}

export default BackgroundParticles;
