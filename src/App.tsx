import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  Scan, 
  RotateCw, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  Leaf, 
  Utensils, 
  FileText, 
  Sparkles, 
  X, 
  ChevronRight, 
  History, 
  Trash2, 
  HelpCircle,
  Clock,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ScanMode, ScanModeConfig, ScannedResult, ScanHistoryItem } from "./types";

// Mode configs with metadata and tailored style attributes
const MODE_CONFIGS: ScanModeConfig[] = [
  {
    id: "general",
    name: "Explore",
    description: "Multi-purpose object, landmark, and device identifier",
    placeholder: "Point at any object or scene to analyze it",
    iconName: "Sparkles",
    color: "from-blue-500 to-indigo-600"
  },
  {
    id: "plant_animal",
    name: "Flora/Fauna",
    description: "Identify species of plants, animals, flowers, or wildlife",
    placeholder: "Scan a flower, plant, pet, or wild organic target",
    iconName: "Leaf",
    color: "from-emerald-500 to-teal-600"
  },
  {
    id: "food",
    name: "Food & Nutrition",
    description: "Estimate macro nutrients, ingredients, and allergy facts",
    placeholder: "Scan any ready meal, raw ingredient, or baked good",
    iconName: "Utensils",
    color: "from-orange-500 to-amber-600"
  },
  {
    id: "text",
    name: "Document OCR",
    description: "Extract text, summarize notes, or translate messages",
    placeholder: "Scan written code, street signs, books, or notes",
    iconName: "FileText",
    color: "from-purple-500 to-pink-600"
  }
];

export default function App() {
  // App state
  const [selectedMode, setSelectedMode] = useState<ScanMode>("general");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraPermission, setCameraPermission] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  
  // Media element handles
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Visual states
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatusMsg, setScanStatusMsg] = useState<string>("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScannedResult | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Local persistent history
  const [history, setHistory] = useState<ScanHistoryItem[]>(() => {
    const saved = localStorage.getItem("ai_scanner_history_v1");
    return saved ? JSON.parse(saved) : [];
  });

  // Keep history synced to localStorage
  useEffect(() => {
    localStorage.setItem("ai_scanner_history_v1", JSON.stringify(history));
  }, [history]);

  // Requesting camera stream
  const initializeCamera = async (forceFacing?: "environment" | "user", deviceId?: string) => {
    // Stop any existing tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const targetFacing = forceFacing || facingMode;
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: targetFacing, width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setCameraPermission("granted");
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Query available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoCamDevices = devices.filter(d => d.kind === "videoinput");
      setCameraDevices(videoCamDevices);
      
      // Select standard matching device if not already set
      if (!deviceId && videoCamDevices.length > 0) {
        // Try fitting matching active track
        const activeTrack = mediaStream.getVideoTracks()[0];
        const settings = activeTrack?.getSettings();
        if (settings?.deviceId) {
          setCurrentDeviceId(settings.deviceId);
        }
      }
    } catch (err: any) {
      console.error("Camera init error:", err);
      // Denied or not found
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraPermission("denied");
      } else {
        setCameraPermission("unsupported");
      }
    }
  };

  // Run camera connection on load
  useEffect(() => {
    initializeCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Toggling camera facing mode
  const toggleFacingMode = () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    setCurrentDeviceId("");
    initializeCamera(nextFacing);
  };

  // Dropdown manual camera device changer
  const handleDeviceChange = (deviceId: string) => {
    setCurrentDeviceId(deviceId);
    initializeCamera(undefined, deviceId);
  };

  // Capture current stream frame as base64 jpeg
  const captureFrame = (): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    
    // Check if video is loaded and has real dimensions
    if (video.readyState < 2 || video.videoWidth === 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Flip base64 context if user-facing front selfie camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.90);
  };

  // Perform Gemini analysis on selected base64 string
  const executeScan = async (base64Image: string) => {
    setIsScanning(true);
    setScanError(null);
    setScanResult(null);
    
    // Rotate messages for engaging retro feeling
    const statuses = [
      "Analyzing light spectrum...",
      "Extracting features & textures...",
      "Identifying organic structures...",
      "Consulting Gemini knowledge base...",
      "Structuring details..."
    ];
    let i = 0;
    setScanStatusMsg(statuses[0]);
    const timer = setInterval(() => {
      i = (i + 1) % statuses.length;
      setScanStatusMsg(statuses[i]);
    }, 1500);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          mimeType: "image/jpeg",
          mode: selectedMode
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}: Failed to analyze`);
      }

      const result: ScannedResult = await response.json();
      setScanResult(result);

      // Add to session saved history (max 30 items)
      const newItem: ScanHistoryItem = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: selectedMode,
        image: base64Image,
        result
      };
      setHistory(prev => [newItem, ...prev.slice(0, 29)]);

    } catch (err: any) {
      console.error(err);
      setScanError(err.message || "Something went wrong while connecting to the AI helper. Please check your internet or retry.");
    } finally {
      clearInterval(timer);
      setIsScanning(false);
    }
  };

  // Scan trigger action from button
  const handleScanAction = () => {
    const snapshot = captureFrame();
    if (!snapshot) {
      setScanError("Unable to grab frame from video camera input. Please ensure camera is connected and showing frames.");
      return;
    }
    setCapturedImage(snapshot);
    executeScan(snapshot);
  };

  // Manual File input trigger
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setCapturedImage(base64);
      executeScan(base64);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCapturedImage(base64);
        executeScan(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear current result and reset camera frame
  const handleReset = () => {
    setCapturedImage(null);
    setScanResult(null);
    setScanError(null);
    // Restart camera if it was stopped or active
    initializeCamera();
  };

  // Tap previous item in history to review it
  const handleSelectHistoryItem = (item: ScanHistoryItem) => {
    setCapturedImage(item.image);
    setSelectedMode(item.mode);
    setScanResult(item.result);
    setScanError(null);
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear your current scanned memory?")) {
      setHistory([]);
    }
  };

  const activeMode = MODE_CONFIGS.find(m => m.id === selectedMode) || MODE_CONFIGS[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased">
      {/* Decorative top pulse effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60 z-55" />

      {/* Embedded application header */}
      <header className="sticky top-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 py-3 z-50 px-4 md:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600/25 border border-indigo-500/30 rounded-xl relative overflow-hidden">
              <Scan className="w-5 h-5 text-indigo-400 animate-pulse" />
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-lg md:text-xl tracking-tight text-white flex items-center gap-1.5">
                AI Object Scanner
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Ready
                </span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">Identify organics, nutrients, objects, and text in real-time</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {cameraDevices.length > 1 && !capturedImage && (
              <select
                id="camera-select"
                value={currentDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="bg-slate-800 text-slate-300 text-xs border border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 max-w-[140px] truncate"
              >
                {cameraDevices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}

            <button
              id="header-manual-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 transition px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-xs text-slate-300"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hidden input element for fallback manual selector */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="camera-app-file-uploader"
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Viewport & Scanning Controls (8 cols on lg) */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-4">
          
          {/* Scanning Mode Quick Selector Row */}
          <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 grid grid-cols-4 gap-1">
            {MODE_CONFIGS.map((mode) => {
              const checked = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  id={`mode-tab-${mode.id}`}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`relative py-2.5 rounded-lg text-xs font-medium transition flex flex-col items-center justify-center space-y-1.5 overflow-hidden border ${
                    checked
                      ? "text-white border-slate-700 bg-slate-800/80 shadow-md"
                      : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900-light"
                  }`}
                >
                  <span className={`p-1 rounded-md bg-slate-800/50 ${checked ? "text-indigo-400" : "text-slate-400"}`}>
                    {mode.id === "plant_animal" && <Leaf className="w-4 h-4" />}
                    {mode.id === "food" && <Utensils className="w-4 h-4" />}
                    {mode.id === "text" && <FileText className="w-4 h-4" />}
                    {mode.id === "general" && <Sparkles className="w-4 h-4" />}
                  </span>
                  <span className="truncate max-w-full font-display font-medium text-[10px] md:text-xs">
                    {mode.name}
                  </span>
                  {checked && (
                    <motion.div
                      layoutId="active-mode-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Mode helper guide info bar */}
          <div className="px-1 text-slate-400 text-xs flex items-center space-x-2">
            <span id="active-mode-description-badge" className="font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-indigo-500/10">
              {activeMode.name}
            </span>
            <span id="active-mode-description" className="truncate text-[11px]">{activeMode.description}</span>
          </div>

          {/* Main Visual Viewport Frame (Standard 16:9 box) */}
          <div
            id="viewport-parent"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative w-full aspect-video bg-slate-900 rounded-2xl border overflow-hidden shadow-2xl transition flex flex-col items-center justify-center ${
              isDragging ? "border-indigo-500 ring-2 ring-indigo-500/20 scale-[0.99]" : "border-slate-800"
            }`}
          >
            {/* Viewport Live State: Show active Camera or still frame */}
            {!capturedImage ? (
              <>
                {/* Active live stream video */}
                {cameraPermission === "granted" ? (
                  <div className="absolute inset-0 w-full h-full">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
                    />
                    
                    {/* Animated Neon Reticle Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-2/3 h-2/3 border border-dashed border-indigo-400/40 rounded-xl relative flex items-center justify-center">
                        {/* Interactive scan laser line */}
                        <motion.div
                          animate={{ top: ["4%", "96%", "4%"] }}
                          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-80 shadow-[0_0_12px_rgba(129,140,248,0.5)]"
                        />
                        {/* Brackets Corners */}
                        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-indigo-400 rounded-tl" />
                        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-indigo-400 rounded-tr" />
                        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-indigo-400 rounded-bl" />
                        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-indigo-400 rounded-br" />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard fallback layout asking for hardware access or prompting upload */
                  <div className="p-6 md:p-10 text-center max-w-sm flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border border-slate-705 relative">
                      <Camera className="w-7 h-7 text-slate-400" />
                      <div className="absolute -inset-1 rounded-full border border-dashed border-slate-700/60 animate-spin [animation-duration:15s]" />
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-display font-medium text-slate-200">Device Camera Offline</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Authorize camera device privileges to unlock digital scans, or import any file directly.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                      <button
                        id="viewport-request-permission-btn"
                        onClick={() => initializeCamera()}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 transition px-3 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Activate Camera
                      </button>
                      <button
                        id="viewport-manual-upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 bg-slate-850 hover:bg-slate-750 transition px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 border border-slate-700 flex items-center justify-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Browse Photos
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Still frame when scanning or result is showing */
              <div className="absolute inset-0 w-full h-full">
                <img
                  src={capturedImage}
                  alt="Captured scan target"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay loading states during processing */}
                <AnimatePresence>
                  {isScanning && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
                    >
                      <div className="w-14 h-14 bg-indigo-600/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center relative mb-4">
                        <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400 border-t-transparent animate-spin" />
                        <Sparkles className="w-6 h-6 text-indigo-400" />
                      </div>
                      
                      <div className="space-y-1 max-w-xs">
                        <p className="text-slate-200 font-display font-medium text-sm animate-pulse">
                          {scanStatusMsg}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">Powered by Gemini-3.5-Flash</p>
                      </div>

                      {/* Moving cyber holographic grid */}
                      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
                        <div className="w-full h-full bg-[linear-gradient(to_right,#818cf8_1px,transparent_1px),linear-gradient(to_bottom,#818cf8_1px,transparent_1px)] bg-[size:24px_24px]" />
                        <motion.div
                          animate={{ y: ["-100%", "100%"] }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                          className="absolute left-0 right-0 h-[80px] bg-gradient-to-b from-indigo-500/0 via-indigo-500/30 to-indigo-500/0"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Drag Zone overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-indigo-950/90 backdrop-blur-xs border-2 border-dashed border-indigo-400 rounded-2xl flex flex-col items-center justify-center p-6 pointer-events-none z-10"
                >
                  <Upload className="w-12 h-12 text-indigo-400 animate-bounce mb-3" />
                  <p className="text-white font-display font-semibold text-sm">Drop your photo here</p>
                  <p className="text-indigo-300 text-xs">Instantly scan with Gemini artificial intelligence</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Primary Viewport Action Row */}
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center justify-between gap-3">
            {!capturedImage ? (
              <>
                <p className="text-slate-400 text-xs hidden md:block max-w-[200px] leading-tight">
                  {cameraPermission === "granted" 
                    ? "Point camera directly at details for optimal intelligence parsing." 
                    : "No stream is running. Choose any photo from your local files to scan."
                  }
                </p>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end flex-wrap gap-y-2">
                  {cameraPermission === "granted" && (
                    <button
                      id="flip-camera-btn"
                      onClick={toggleFacingMode}
                      className="p-2.5 bg-slate-800 hover:bg-slate-750 transition text-slate-350 hover:text-white rounded-xl border border-slate-700 hover:border-slate-650"
                      title="Flip lens direction"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    id="trigger-scan-btn"
                    onClick={handleScanAction}
                    disabled={cameraPermission !== "granted"}
                    className={`px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition ${
                      cameraPermission === "granted"
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-indigo-500/20 cursor-pointer"
                        : "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                    }`}
                  >
                    <Scan className="w-4 h-4" />
                    <span>Analyze Frame</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  <span className="font-mono">Locked Viewframe</span>
                </div>

                <button
                  id="reset-scan-btn"
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 transition font-semibold text-xs text-slate-300 rounded-xl border border-slate-700"
                >
                  Clear & Scan New
                </button>
              </>
            )}
          </div>
        </section>

        {/* Right Column: Dynamic Analysis Outcomes & Historic logs (4 cols on lg) */}
        <section className="lg:col-span-5 xl:col-span-4 flex flex-col space-y-6">

          {/* Context Results Display Area */}
          <div id="results-container" className="flex flex-col space-y-4">
            <h2 className="font-display font-medium text-sm text-slate-400 uppercase tracking-widest pl-1">
              Analysis Results
            </h2>

            {/* Error notifications */}
            {scanError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-slate-200 text-xs flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-400">Scan failed</p>
                  <p className="text-slate-400 leading-relaxed text-[11px]">{scanError}</p>
                  {scanError.includes("GEMINI_API_KEY") && (
                    <p className="text-indigo-400 pt-1 leading-normal font-medium">To fix this, go to Settings &gt; Secrets and input a valid API Key.</p>
                  )}
                </div>
              </div>
            )}

            {/* In-turn scanner placeholder if empty */}
            {!scanResult && !isScanning && !scanError && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 flex flex-col items-center space-y-3">
                <div className="p-3 bg-slate-850 rounded-full border border-slate-800">
                  <Sparkles className="w-5 h-5 text-slate-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-display font-medium text-slate-400 text-xs">Waiting for scan data</h4>
                  <p className="text-[11px] text-slate-500 leading-normal max-w-xs mx-auto">
                    Snapping an image or feeding folder items will instantly engage intelligence parsing down in this card frame.
                  </p>
                </div>
              </div>
            )}

            {/* Scan processing mock skeleton */}
            {isScanning && !scanResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="space-y-2">
                  <div className="h-4 bg-slate-800 rounded-md w-1/3 animate-pulse" />
                  <div className="h-3 bg-slate-800 rounded-md w-1/2 animate-pulse" />
                </div>
                <div className="h-16 bg-slate-800 rounded-md w-full animate-pulse" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-8 bg-slate-800 rounded-md animate-pulse" />
                  <div className="h-8 bg-slate-800 rounded-md animate-pulse" />
                </div>
              </div>
            )}

            {/* Robust successfully returned structured context card */}
            {scanResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
              >
                {/* Header ribbon */}
                <div className="bg-gradient-to-r from-indigo-900/50 via-purple-900/45 to-indigo-950/20 border-b border-indigo-950 px-4 py-3 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    AI Intelligence Frame
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                    mode: {selectedMode}
                  </span>
                </div>

                <div className="p-4 md:p-5 space-y-4">
                  {/* Title & Classification */}
                  <div>
                    <h3 id="result-detected-name" className="font-display font-medium text-lg leading-snug text-white">
                      {scanResult.detectedItem}
                    </h3>
                    <p id="result-subtitle" className="text-xs text-indigo-400 mt-0.5 font-mono italic">
                      {scanResult.subtitle}
                    </p>
                  </div>

                  {/* Concise description */}
                  <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                    <p id="result-description" className="text-xs text-slate-300 leading-relaxed">
                      {scanResult.description}
                    </p>
                  </div>

                  {/* Attributes GRID (Label Value pair layout) */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                      Target Metrics & Attributes
                    </h4>
                    
                    <div id="result-attributes-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {scanResult.attributes?.map((attr, idx) => (
                        <div key={idx} className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850 flex flex-col">
                          <span className="text-[9px] font-mono text-slate-450 uppercase tracking-wider">
                            {attr.label}
                          </span>
                          <span className="text-xs text-slate-250 font-medium truncate mt-0.5">
                            {attr.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extra Context Banner */}
                  {scanResult.extraContext && (
                    <div className="bg-indigo-950/15 border border-indigo-900/10 rounded-xl p-3.5 space-y-1">
                      <div className="flex items-center space-x-1.5 text-indigo-400 font-display font-medium text-xs">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Fascinating Context & Guidance</span>
                      </div>
                      <p id="result-extra-context" className="text-[11px] text-slate-400 leading-normal">
                        {scanResult.extraContext}
                      </p>
                    </div>
                  )}
                  
                  {/* Google search link for quick check */}
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(scanResult.detectedItem)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-1.5 py-1.5 w-full bg-slate-850 hover:bg-slate-800 transition text-slate-400 hover:text-indigo-400 rounded-lg text-[10px] font-mono border border-slate-800"
                  >
                    <span>Search Google for {scanResult.detectedItem}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </motion.div>
            )}
          </div>

          {/* Saved History Shelf */}
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between pl-1">
              <h2 className="font-display font-medium text-sm text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                <History className="w-4 h-4" />
                <span>Saved Memory ({history.length})</span>
              </h2>
              {history.length > 0 && (
                <button
                  id="clear-all-history-btn"
                  onClick={clearHistory}
                  className="text-xs text-red-400 hover:text-red-300 transition flex items-center space-x-1 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-850 text-center text-slate-500 text-xs">
                Scanning items will create a quick visual session history here.
              </div>
            ) : (
              <div id="history-scroller" className="grid grid-cols-5 g-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    id={`history-item-${item.id}`}
                    onClick={() => handleSelectHistoryItem(item)}
                    className="group relative aspect-square bg-slate-900 border border-slate-800 hover:border-indigo-500/60 transition rounded-xl overflow-hidden focus:outline-none"
                    title={`Review ${item.result.detectedItem}`}
                  >
                    <img
                      src={item.image}
                      alt={item.result.detectedItem}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                    />
                    {/* Small category overlay icon */}
                    <div className="absolute top-1 right-1 p-0.5 bg-slate-950/80 rounded border border-slate-800/40 text-[9px] text-indigo-400">
                      {item.mode === "plant_animal" && <Leaf className="w-2.5 h-2.5" />}
                      {item.mode === "food" && <Utensils className="w-2.5 h-2.5" />}
                      {item.mode === "text" && <FileText className="w-2.5 h-2.5" />}
                      {item.mode === "general" && <Sparkles className="w-2.5 h-2.5" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
