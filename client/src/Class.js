import React, { useEffect, useRef, useState } from "react";
import * as tmImage from "@teachablemachine/image";

const MODEL_URL = "/model/";

function Class() {
  const [statusText, setStatusText] = useState("Loading model...");
  const [prediction, setPrediction] = useState("");
  const [model, setModel] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [inputMode, setInputMode] = useState("upload");
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState("");
  const [webcamCaptureUrl, setWebcamCaptureUrl] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isPredictingRef = useRef(false);
  const previewUrlRef = useRef("");
  const webcamCaptureUrlRef = useRef("");
  const isAnalyzing = statusText === "Analyzing image...";

  useEffect(() => {
    const loadModel = async () => {
      try {
        const modelURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";
        const loadedModel = await tmImage.load(modelURL, metadataURL);

        setModel(loadedModel);
        setStatusText("Model ready. Upload an image to classify.");
      } catch (error) {
        console.error("Model loading failed:", error);
        setStatusText("Error loading model");
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (previewUrlRef.current) {
        window.URL.revokeObjectURL(previewUrlRef.current);
      }

      if (webcamCaptureUrlRef.current) {
        window.URL.revokeObjectURL(webcamCaptureUrlRef.current);
      }
    };
  }, []);

  const updatePrediction = async (source) => {
    if (!model || isPredictingRef.current) return;

    isPredictingRef.current = true;
    try {
      const predictions = await model.predict(source);
      const top = predictions.reduce((max, current) =>
        current.probability > max.probability ? current : max
      );

      setPrediction(`${top.className} (${(top.probability * 100).toFixed(2)}%)`);
      setStatusText("Prediction complete");
    } catch (error) {
      console.error("Prediction failed:", error);
      setStatusText("Prediction error");
    } finally {
      isPredictingRef.current = false;
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsWebcamActive(false);
  };

  const startWebcam = async () => {
    if (!model || isLoading) return;

    try {
      setWebcamError("");
      setPrediction("");
      setStatusText("Starting webcam...");

      if (previewUrlRef.current) {
        window.URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
      setPreviewUrl("");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setWebcamError("Webcam is not supported in this browser.");
        setStatusText("Webcam unavailable");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsWebcamActive(true);
      setStatusText("Webcam live. Click Capture Photo to classify.");
    } catch (error) {
      console.error("Webcam failed:", error);
      const isInsecure = window.location.protocol !== "https:" && window.location.hostname !== "localhost";
      if (isInsecure) {
        setWebcamError("Camera requires HTTPS or localhost. Open this app on a secure URL.");
      } else if (error && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
        setWebcamError("Camera permission was denied. Allow camera access and try again.");
      } else {
        setWebcamError("Could not access webcam. Allow camera permission and try again.");
      }
      setStatusText("Webcam unavailable");
      stopWebcam();
    }
  };

  const captureFromWebcam = () => {
    if (!videoRef.current || !isWebcamActive || isCapturing) return;

    const video = videoRef.current;
    const hasFrame = video.readyState >= 2;
    if (!hasFrame) {
      setStatusText("Waiting for camera frame...");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext("2d");
    if (!context) {
      setStatusText("Capture error");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setIsCapturing(true);
    setPrediction("");
    setStatusText("Analyzing captured photo...");

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatusText("Capture error");
        setIsCapturing(false);
        return;
      }

      if (webcamCaptureUrlRef.current) {
        window.URL.revokeObjectURL(webcamCaptureUrlRef.current);
      }

      const captureUrl = window.URL.createObjectURL(blob);
      webcamCaptureUrlRef.current = captureUrl;
      setWebcamCaptureUrl(captureUrl);

      const snapshot = new Image();
      snapshot.src = captureUrl;
      snapshot.onload = async () => {
        await updatePrediction(snapshot);
        setIsCapturing(false);
      };
      snapshot.onerror = () => {
        setStatusText("Capture error");
        setIsCapturing(false);
      };
    }, "image/jpeg", 0.92);
  };

  const switchMode = (mode) => {
    if (mode === inputMode) return;

    if (mode === "upload") {
      stopWebcam();
      setWebcamError("");
      setStatusText("Model ready. Upload an image to classify.");
    } else {
      if (previewUrlRef.current) {
        window.URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
      setPreviewUrl("");
      setStatusText("Switch to webcam and start camera.");
    }

    if (webcamCaptureUrlRef.current) {
      window.URL.revokeObjectURL(webcamCaptureUrlRef.current);
      webcamCaptureUrlRef.current = "";
    }
    setWebcamCaptureUrl("");
    setPrediction("");
    setInputMode(mode);
  };

  const handleImageUpload = (event) => {
    if (!model) return;

    stopWebcam();

    const file = event.target.files[0];
    if (!file) return;

    const objectUrl = window.URL.createObjectURL(file);
    const img = document.createElement("img");

    if (previewUrlRef.current) {
      window.URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = objectUrl;

    setPrediction("");
    setPreviewUrl(objectUrl);
    setWebcamCaptureUrl("");
    setWebcamError("");
    setStatusText("Analyzing image...");
    img.src = objectUrl;

    img.onload = async () => {
      await updatePrediction(img);
    };
  };

  return (
    <section className="classifier">
      <div className="mode-switch" role="tablist" aria-label="Choose input type">
        <button
          type="button"
          className={`mode-btn ${inputMode === "upload" ? "active" : ""}`}
          onClick={() => switchMode("upload")}
          disabled={isLoading}
        >
          Upload Image
        </button>
        <button
          type="button"
          className={`mode-btn ${inputMode === "webcam" ? "active" : ""}`}
          onClick={() => switchMode("webcam")}
          disabled={isLoading}
        >
          Use Webcam
        </button>
      </div>

      {inputMode === "upload" ? (
        <>
          <label className={`upload-cta ${isLoading ? "disabled" : ""}`}>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={isLoading}
            />
            <span>{isLoading ? "Preparing model..." : "Choose an Image"}</span>
          </label>

          {previewUrl ? (
            <div className="preview-wrap reveal-in">
              <img src={previewUrl} alt="Uploaded plant preview" className="preview-image" />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="webcam-actions">
            <button
              type="button"
              className="control-btn"
              onClick={isWebcamActive ? stopWebcam : startWebcam}
              disabled={isLoading}
            >
              {isWebcamActive ? "Stop Camera" : "Start Camera"}
            </button>
            <button
              type="button"
              className="control-btn capture-btn"
              onClick={captureFromWebcam}
              disabled={!isWebcamActive || isLoading || isCapturing}
            >
              {isCapturing ? "Capturing..." : "Capture Photo"}
            </button>
          </div>

          <div className="webcam-panels reveal-in">
            <div className="preview-wrap webcam-frame">
              <div className={`webcam-stage ${isWebcamActive ? "has-feed" : ""}`}>
                <video ref={videoRef} className="webcam-video" playsInline muted />
              </div>
            </div>
            <div className="preview-wrap captured-frame">
              {webcamCaptureUrl ? (
                <img
                  src={webcamCaptureUrl}
                  alt="Captured webcam input"
                  className="preview-image"
                />
              ) : (
                <div className="capture-placeholder">Captured photo will appear here</div>
              )}
            </div>
          </div>

          {webcamError ? <p className="webcam-error">{webcamError}</p> : null}
        </>
      )}

      <p className={`status-text ${isAnalyzing ? "is-busy" : ""}`}>{statusText}</p>
      {prediction ? (
        <h2 key={prediction} className="prediction-pill pop-in">
          {prediction}
        </h2>
      ) : null}
    </section>
  );
}

export default Class;