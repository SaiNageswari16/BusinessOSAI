import os

target = os.path.join("frontend", "src", "components", "hrms", "EmployeeSelfService.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_end = """        </div>
      )}
    </div>
  );
}"""

face_modal_block = """        </div>
      )}

      {/* Face ID Scanner Simulation Modal */}
      {faceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-2xl bg-card border shadow-2xl p-6 text-center space-y-6">
            <div>
              <h3 className="font-bold text-lg text-foreground flex items-center justify-center gap-2">
                <Camera className="size-5 text-primary animate-pulse" /> Face ID Recognition
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Simulated scanner for attendance verification</p>
            </div>

            {/* Simulated Camera Window */}
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
            </div>

            {/* Progress bar */}
            {scanning && (
              <div className="space-y-1.5">
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-200" style={{ width: `${scanProgress}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">Analyzing details... {scanProgress}%</p>
              </div>
            )}

            {scanSuccess && (
              <p className="text-sm font-semibold text-emerald-600 animate-pulse">Attendance Punch Successful!</p>
            )}

            <Button variant="outline" className="w-full text-xs h-9 border-muted" onClick={() => { setFaceModalOpen(false); setCameraActive(false); }}>
              Cancel Scan
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}"""

line_ending = "\r\n" if "\r\n" in content else "\n"

content = content.replace(target_end.replace("\n", line_ending), face_modal_block.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Appended Face Scan simulation modal successfully")
