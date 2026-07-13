import os

target = os.path.join("frontend", "src", "components", "hrms", "AttendanceManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# Let's locate the buggy return block for face_recognition
old_block = """  // ─── Render: Face Recognition Logs ──────────────────────────────
  if (tab === "face_recognition") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Face Recognition Logs</h1>
            <p className="text-sm text-muted-foreground">Live matching metrics from tablet entrance cameras.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setFaceSimDialogOpen(true)} className="gradient-brand text-white border-0 h-9 font-medium">
              <Camera className="size-4 mr-1.5" /> Simulate Face Match
            </Button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold animate-pulse">
              <span className="size-2 rounded-full bg-emerald-500" /> Active Feed
            </span>
          </div>
        </div>

        {loading && faceLogs.length === 0 && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}

        <div className="glass-panel rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-6 py-4">Event Time</th>
                  <th className="px-6 py-4">Employee Match</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4 text-right">Confidence Score</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {faceLogs.length === 0 && !loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No face logs recorded today.</td></tr>
                ) : faceLogs.map((log, i) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs">{formatTime(log.timestamp)}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{log.employee_name}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{log.location}</td>
                    <td className="px-6 py-4"><span className="px-2 py-0.5 bg-secondary text-xs rounded font-bold uppercase">{log.action}</span></td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-500">{log.confidence}%</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${log.status === "Verified" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Admin Face scanner match simulator dialog */}
      {faceSimDialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Camera className="size-5 text-primary" /> Simulate Entrance Face Match
            </h3>
            <form onSubmit={handleSimulateFaceMatch} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee Profile</label>
                <select value={simEmpId} onChange={e => setSimEmpId(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Action</label>
                  <select value={simAction} onChange={e => setSimAction(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option>Check-In</option>
                    <option>Check-Out</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Confidence Score</label>
                  <input type="number" min="80" max="100" step="0.1" value={simConfidence} onChange={e => setSimConfidence(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Scanner Location</label>
                <input type="text" value={simLocation} onChange={e => setSimLocation(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setFaceSimDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm flex items-center gap-1.5" disabled={simulatingMatch}>
                  {simulatingMatch ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                  Simulate Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    );
  }"""

new_block = """  // ─── Render: Face Recognition Logs ──────────────────────────────
  if (tab === "face_recognition") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Face Recognition Logs</h1>
            <p className="text-sm text-muted-foreground">Live matching metrics from tablet entrance cameras.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setFaceSimDialogOpen(true)} className="gradient-brand text-white border-0 h-9 font-medium">
              <Camera className="size-4 mr-1.5" /> Simulate Face Match
            </Button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold animate-pulse">
              <span className="size-2 rounded-full bg-emerald-500" /> Active Feed
            </span>
          </div>
        </div>

        {loading && faceLogs.length === 0 && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}

        <div className="glass-panel rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-6 py-4">Event Time</th>
                  <th className="px-6 py-4">Employee Match</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4 text-right">Confidence Score</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {faceLogs.length === 0 && !loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No face logs recorded today.</td></tr>
                ) : faceLogs.map((log, i) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs">{formatTime(log.timestamp)}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{log.employee_name}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{log.location}</td>
                    <td className="px-6 py-4"><span className="px-2 py-0.5 bg-secondary text-xs rounded font-bold uppercase">{log.action}</span></td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-500">{log.confidence}%</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${log.status === "Verified" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin Face scanner match simulator dialog (moved inside the parent div wrapper) */}
        {faceSimDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Camera className="size-5 text-primary" /> Simulate Entrance Face Match
              </h3>
              <form onSubmit={handleSimulateFaceMatch} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee Profile</label>
                  <select value={simEmpId} onChange={e => setSimEmpId(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                    <option value="">-- Choose Employee --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Action</label>
                    <select value={simAction} onChange={e => setSimAction(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                      <option>Check-In</option>
                      <option>Check-Out</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Confidence Score</label>
                    <input type="number" min="80" max="100" step="0.1" value={simConfidence} onChange={e => setSimConfidence(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Scanner Location</label>
                  <input type="text" value={simLocation} onChange={e => setSimLocation(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setFaceSimDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm flex items-center gap-1.5" disabled={simulatingMatch}>
                    {simulatingMatch ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                    Simulate Match
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content.replace(old_block.replace("\n", line_ending), new_block.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Fixed JSX parse nesting brackets error in AttendanceManagement.tsx successfully")
