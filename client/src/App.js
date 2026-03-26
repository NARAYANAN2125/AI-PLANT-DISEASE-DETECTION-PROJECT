import React from "react";
import "./App.css";
import Class from "./Class";

function App() {
  return (
    <div className="app-shell">
      <main className="app-card">
        <p className="eyebrow slide-in"></p>
        <h1 className="slide-in delayed-1">AI Plant Classifier</h1>
        <p className="subtitle slide-in delayed-2">
          Upload a plant image to get an instant prediction from your trained
          model.
        </p>
        <Class />
      </main>
    </div>
  );
}

export default App;