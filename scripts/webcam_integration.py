import os

target = os.path.join("frontend", "src", "components", "hrms", "EmployeeSelfService.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add useRef to react imports if not present
old_react_import = 'import React, { useState, useEffect, useCallback } from "react";'
new_react_import = 'import React, { useState, useEffect, useCallback, useRef } from "react";'

content = content.replace(old_react_import, new_react_import)

# 2. Add videoRef and camera streaming useEffect inside EmployeeSelfService component
old_states = """  // Face Scan Simulation states
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);"""

new_states_and_effect = """  // Face Scan Simulation states
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Hook to start/stop actual webcam stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (cameraActive && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { width: 300, height: 300 } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(err => {
          console.warn("Webcam access rejected or unavailable: ", err);
        });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraActive, faceModalOpen]);"""

content = content.replace(old_states, new_states_and_effect)

# 3. Replace the mock camera scanner div with the real video element in scanner circle
old_scanner_circle = """            {/* Simulated Camera Window */}
            <div className="aspect-square w-[200px] h-[200px] mx-auto rounded-full border-4 border-dashed border-primary/30 relative overflow-hidden bg-muted flex items-center justify-center shadow-inner">
              {cameraActive && !scanSuccess && (
                <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent flex flex-col justify-end p-3">
                  <div className="w-full h-0.5 bg-primary animate-[bounce_2s_infinite] shadow-[0_0_8px_rgba(var(--primary),0.5)] mb-8" />
                  <p className="text-[10px] font-mono text-primary/80 uppercase tracking-widest mb-1 text-center font-bold">Scanning...</p>
                </div>
              )}
              {scanSuccess ? (
                <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="space-y-2">
                  <ShieldCheck className="size-16 text-emerald-500 mx-auto animate-bounce" />
                  <p className="text-emerald-500 font-bold text-xs">Verified 99.4%</p>
                </motion.div>
              ) : (
                <div className="text-center space-y-2 text-muted-foreground">
                  <Camera className="size-10 mx-auto opacity-40 animate-pulse" />
                  <p className="text-[10px]">Position face inside ring</p>
                </div>
              )}
            </div>"""

new_scanner_circle = """            {/* Real Webcam Stream with Neon Scanner Beam Overlay */}
            <div className="aspect-square w-[200px] h-[200px] mx-auto rounded-full border-4 border-primary/50 relative overflow-hidden bg-slate-900 flex items-center justify-center shadow-2xl">
              {/* Webcam stream */}
              {cameraActive && !scanSuccess && (
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
              )}

              {/* Scanning Overlay Beam */}
              {cameraActive && !scanSuccess && (
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/20 to-transparent flex flex-col justify-between pointer-events-none p-3">
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-[bounce_3s_infinite] shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                  <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest mb-1 text-center font-bold bg-slate-950/60 py-0.5 rounded backdrop-blur-[2px]">Face Scanning...</p>
                </div>
              )}

              {scanSuccess ? (
                <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="z-10 bg-slate-950/80 p-4 rounded-xl space-y-2 backdrop-blur-md">
                  <ShieldCheck className="size-12 text-emerald-400 mx-auto animate-bounce" />
                  <p className="text-emerald-400 font-bold text-xs">Access Granted (99.4%)</p>
                </motion.div>
              ) : !cameraActive && (
                <div className="text-center space-y-2 text-muted-foreground z-10">
                  <Camera className="size-10 mx-auto opacity-40 animate-pulse" />
                  <p className="text-[10px]">Initializing Webcam...</p>
                </div>
              )}
            </div>"""

line_ending = "\r\n" if "\r\n" in content else "\n"

content = content.replace(old_scanner_circle.replace("\n", line_ending), new_scanner_circle.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated EmployeeSelfService.tsx to use real webcam video streaming stream successfully")
