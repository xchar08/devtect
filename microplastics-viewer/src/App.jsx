// App.js
import React, { useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { motion } from "framer-motion"; // Import Framer Motion
import Navigation from "./components/Navigation";
import Level3Map from "./components/Level3Map";
import TimeLapseMonthly from "./components/TimeLapseMonthly";
import MitigationSim from "./components/MitigationSim";
import MicroplasticsNodeGraph3D from "./components/MicroplasticsNodeGraph3D";
import AIPredictions from "./components/AIPredictions";
import AIYearHeatmapMitigation from "./components/AIYearHeatmapMitigation";
import RotatingD from "./components/microplasticsD"; // 3D Rotating D component
import micro from "./assets/images/micro.jpeg"; // Update the path if necessary
import BackgroundParticles from "./components/BackgroundParticles"; // Optional: Animated Background
import { FaMapMarkedAlt, FaChartLine, FaCube, FaRobot } from "react-icons/fa"; // Importing icons
import FeatureModal from "./components/FeatureModal"; // Import FeatureModal

function App() {
  const videoSectionRef = useRef(null); // Ref for the video section

  const scrollToVideoSection = () => {
    videoSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Variants for the Hero Section text rows
  const heroTextContainer = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.3,
      },
    },
  };

  const heroTextVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // Data for Features
  const featuresData = [
    {
      title: "Interactive Heatmaps",
      description:
        "Visualize global microplastic concentrations with dynamic heatmaps, allowing for easy identification of pollution hotspots and trends over time.",
      icon: <FaMapMarkedAlt size={40} className="text-blue-600" />,
    },
    {
      title: "Monthly Distributions",
      description:
        "Analyze microplastic levels on a monthly basis to track fluctuations, seasonal patterns, and the effectiveness of mitigation efforts.",
      icon: <FaChartLine size={40} className="text-blue-600" />,
    },
    {
      title: "3D Visualizations",
      description:
        "Explore our 3D node graphs to understand the intricate relationships and distributions of microplastics across different regions.",
      icon: <FaCube size={40} className="text-blue-600" />,
    },
    {
      title: "AI Predictions",
      description:
        "Leverage advanced AI models to predict future microplastic pollution trends and assess the impact of various mitigation strategies.",
      icon: <FaRobot size={40} className="text-blue-600" />,
    },
    // Add more features as needed
  ];

  // State for Modal
  const [selectedFeature, setSelectedFeature] = React.useState(null);
  const [modalIsOpen, setModalIsOpen] = React.useState(false);

  const openModal = (feature) => {
    setSelectedFeature(feature);
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedFeature(null);
  };

  return (
    <BrowserRouter>
      <>
        <BackgroundParticles /> {/* Optional: Animated Background */}
        <Navigation />
        <div className="pt-1"> {/* Padding top to avoid content under fixed nav */}
          <Routes>
            <Route
              path="/"
              element={
                <div className="space-y-24">
                  {/* Get Started Section */}
                  <motion.section
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-screen p-8 rounded-lg shadow-md flex flex-col md:flex-row items-center"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1 }}
                  >
                    <div className="md:w-1/2">
                      <motion.h1
                        className="text-5xl font-extrabold text-white mb-4"
                        initial={{ opacity: 0, x: -100 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, delay: 0.2 }}
                      >
                        Discover the Impact of Microplastics
                      </motion.h1>
                      <motion.p
                        className="text-lg text-white mb-6"
                        initial={{ opacity: 0, x: -100 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, delay: 0.4 }}
                      >
                        Our platform provides comprehensive insights into global
                        microplastic pollution through interactive heatmaps,
                        monthly distributions, 3D visualizations, and advanced AI
                        predictions. Understand patterns, track changes over time,
                        and explore effective mitigation strategies to combat this
                        pressing environmental issue.
                      </motion.p>
                      <motion.a
                        href="/aipredictions"
                        className="inline-block bg-white text-blue-600 px-6 py-3 rounded-full shadow hover:bg-gray-100 transition duration-300 font-semibold"
                        whileHover={{ scale: 1.05, backgroundColor: "#f3f4f6" }}
                        whileTap={{ scale: 0.95 }}
                        aria-label="Get started with AI predictions"
                      >
                        Get Started
                      </motion.a>
                    </div>
                    <div className="md:w-1/2 mt-6 md:mt-0">
                      <motion.img
                        src={micro}
                        alt="Microplastics"
                        className="w-full h-auto rounded-lg shadow-lg"
                        loading="lazy"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, delay: 0.6 }}
                      />
                    </div>
                  </motion.section>

                  {/* Hero Section */}
                  <section className="bg-gray-100 h-screen flex items-center justify-center relative">
                    <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between">
                      {/* 3D Rotating D */}
                      <div className="md:w-1/2 flex justify-center md:justify-start mb-8 md:mb-0">
                        <div className="w-[400px] h-[400px] md:w-[400px] md:h-[800px]">
                          <RotatingD />
                        </div>
                      </div>

                      {/* Text Content */}
                      <motion.div
                        className="md:w-1/2 text-center md:text-left relative"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 1, delay: 0.2 }}
                      >
                        {/* Animated Text Rows */}
                        <motion.div
                          className="space-y-4" // Reduced spacing
                          variants={heroTextContainer}
                          initial="hidden"
                          whileInView="visible"
                          viewport={{ once: true, amount: 0.3 }}
                        >
                          {[
                            "Devtect is a leader in AI-powered microplastics analysis.",
                            "Discover the tools and strategies to combat global microplastic pollution.",
                            "Through interactive heatmaps, advanced AI models, and 3D visualizations.",
                            "Together, we can build a cleaner, safer future."
                          ].map((line, index) => (
                            <motion.h1
                              key={index}
                              className="text-2xl md:text-3xl font-medium text-gray-900 px-2" // Reduced text size and adjusted font weight
                              variants={heroTextVariant}
                            >
                              {line}
                            </motion.h1>
                          ))}
                        </motion.div>
                        <motion.button
                          className="mt-6 bg-blue-600 text-white px-5 py-2 rounded-full shadow-md hover:shadow-lg hover:bg-blue-700 transition duration-300 text-sm" // Adjusted button size and text
                          onClick={scrollToVideoSection}
                          whileHover={{ scale: 1.05, backgroundColor: "#2563eb" }}
                          whileTap={{ scale: 0.95 }}
                          aria-label="Learn more about microplastics pollution"
                        >
                          Learn More
                        </motion.button>
                      </motion.div>
                    </div>
                  </section>


                  {/* Fullscreen Video Section */}
                  <section
                    ref={videoSectionRef}
                    className="relative w-full h-screen bg-black"
                  >
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src="https://www.youtube.com/embed/rug4z8Iivd8?autoplay=1&mute=1&loop=1&playlist=rug4z8Iivd8"
                      title="Microplastics Overview"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </section>

                  {/* Enhanced Features Section */}
                  <section className="py-16 bg-gray-50">
                    <div className="max-w-7xl mx-auto px-4">
                      <h2 className="text-4xl font-bold text-center text-blue-700 mb-12">
                        Our Features
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {featuresData.map((feature, index) => (
                          <motion.div
                            key={index}
                            className="bg-white p-8 rounded-lg shadow-lg hover:shadow-2xl transition-shadow duration-300 flex flex-col items-center cursor-pointer"
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.8, delay: index * 0.2 }}
                            onClick={() => openModal(feature)}
                          >
                            <div className="flex items-center justify-center mb-6">
                              {feature.icon}
                            </div>
                            <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">
                              {feature.title}
                            </h3>
                            <p className="text-gray-600 text-center">
                              {feature.description}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                      {/* Feature Modal */}
                      <FeatureModal
                        isOpen={modalIsOpen}
                        onRequestClose={closeModal}
                        feature={selectedFeature}
                      />
                    </div>
                  </section>

                  {/* Time Lapse Section */}
                  <section>
                    <TimeLapseMonthly />
                  </section>
                </div>
              }
            />
            {/* Define other routes as needed */}
            <Route path="/level3" element={<Level3Map />} />
            <Route path="/mitigation" element={<MitigationSim />} />
            <Route path="/nodegraph3d" element={<MicroplasticsNodeGraph3D />} />
            <Route path="/aipredictions" element={<AIPredictions />} />
            <Route
              path="/ai-year-mitigation"
              element={<AIYearHeatmapMitigation />}
            />
          </Routes>
        </div>
      </>
    </BrowserRouter>
  );
}

export default App;
