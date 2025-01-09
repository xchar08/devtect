// src/components/FeatureModal.js
import React from "react";
import Modal from "react-modal";
import { motion } from "framer-motion";

// Accessibility: Bind modal to your appElement (https://reactcommunity.org/react-modal/accessibility/)
Modal.setAppElement("#root");

const FeatureModal = ({ isOpen, onRequestClose, feature }) => {
  if (!feature) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel={feature.title}
      className="max-w-2xl mx-auto my-20 bg-white rounded-lg shadow-lg p-8 outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={onRequestClose}
          className="text-gray-500 hover:text-gray-700 float-right text-2xl"
          aria-label="Close Modal"
        >
          &times;
        </button>
        <div className="clear-both">
          <h2 className="text-3xl font-bold text-blue-700 mb-4">{feature.title}</h2>
          <div className="flex items-center justify-center mb-6">
            {feature.icon}
          </div>
          <p className="text-gray-700">{feature.description}</p>
          {/* Add more detailed information if available */}
        </div>
      </motion.div>
    </Modal>
  );
};

export default FeatureModal;
