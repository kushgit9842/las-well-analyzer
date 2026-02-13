import { useEffect, useState, useRef } from "react";
import api from "./api";
import Plotly from "plotly.js-dist-min";

function App() {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const cleanedPlotRef = useRef<HTMLDivElement | null>(null);
  const axisRangesRef = useRef<Record<string, [number, number]>>({});

  const [wells, setWells] = useState<any[]>([]);
  const [curves, setCurves] = useState<any[]>([]);
  const [selectedWell, setSelectedWell] = useState("");
  const [selectedCurves, setSelectedCurves] = useState<string[]>([]);
  const [fromDepth, setFromDepth] = useState(0);
  const [toDepth, setToDepth] = useState(0);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [interpretation, setInterpretation] = useState<any>(null);
  const [showAI, setShowAI] = useState(false);

  // Chatbot state
  const [chatMessages, setChatMessages] = useState<{ sender: "user" | "bot"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const loadWells = async () => {
    const res = await api.get("/wells");
    setWells(res.data);
  };

  useEffect(() => {
    loadWells();
  }, []);

  useEffect(() => {
    if (!selectedWell) return;

    const well = wells.find(w => w.id === selectedWell);
    if (well) {
      setFromDepth(well.start_depth || 0);
      setToDepth(well.stop_depth || 0);
    }

    api.get(`/wells/${selectedWell}/curves`)
      .then(res => {
        // Remove "Depth" from selectable curves
        const filteredCurves = res.data.filter(
          (c: any) => c.name !== "Depth" && c.name !== "Time"
        );

        setCurves(filteredCurves);

        if (filteredCurves.length > 0) {
          setSelectedCurves([filteredCurves[0].name]);
        } else {
          setSelectedCurves([]);
        }
      });

  }, [selectedWell, wells]);

  const fetchData = async () => {
    if (!selectedWell || selectedCurves.length === 0) return;

    setLoading(true);

    try {
      // Fetch curve data
      const res = await api.get(
        `/wells/${selectedWell}/data?from=${fromDepth}&to=${toDepth}&curves=${selectedCurves.join(",")}`
      );

      setData(res.data);
    } catch (error) {
      console.error(error);
      alert("Failed to load data or interpretation");
    } finally {
      setLoading(false);
    }
  };

  const runAIInterpretation = async () => {
    if (!selectedWell || selectedCurves.length === 0) return;

    try {
      const interpretationRes = await api.post(
        `/wells/${selectedWell}/interpret`,
        {
          from: fromDepth,
          to: toDepth,
          curves: selectedCurves
        }
      );

      setInterpretation(interpretationRes.data);
      setShowAI(true);
    } catch (error) {
      console.error(error);
      alert("AI interpretation failed");
    }
  };

  // Chatbot send message
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedWell) return;

    const userMessage = { sender: "user" as const, text: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    const messageToSend = chatInput;
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await api.post(
        `/wells/${selectedWell}/chat`,
        { message: messageToSend }
      );

      setChatMessages(prev => [
        ...prev,
        { sender: "bot", text: res.data.reply || "No response" }
      ]);
    } catch (error) {
      setChatMessages(prev => [
        ...prev,
        { sender: "bot", text: "Chat processing failed." }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("lasFile", selectedFile);

    try {
      setUploading(true);
      await api.post("/upload-las", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setSelectedFile(null);
      await loadWells();
      alert("LAS file uploaded successfully");
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteWell = async (wellId: string) => {
    if (!window.confirm("Are you sure you want to delete this well?")) return;

    try {
      await api.delete(`/wells/${wellId}`);
      if (selectedWell === wellId) {
        setSelectedWell("");
        setCurves([]);
        setData([]);
      }
      await loadWells();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  useEffect(() => {
    if (!plotRef.current || data.length === 0) return;

    // Compute and persist fixed axis ranges per curve
    selectedCurves.forEach(curve => {
      if (!axisRangesRef.current[curve]) {
        const values = data
          .map(d => d.values?.[curve])
          .filter((v: any) => typeof v === "number");

        if (values.length > 0) {
          const min = Math.min(...values);
          const max = Math.max(...values);
          axisRangesRef.current[curve] = [min, max];
        }
      }
    });

    Plotly.newPlot(
      plotRef.current,
      (() => {
        const traces: any[] = [];

        selectedCurves.forEach((curve, index) => {
          const xValues = data.map(d => d.depth);
          const yValues = data.map(d => d.values?.[curve]);

          // Main curve line
          traces.push({
            x: xValues,
            y: yValues,
            type: "scatter",
            mode: "lines",
            name: curve,
            line: { width: 2 },
            yaxis: index === 0 ? "y" : `y${index + 1}`
          });

          // Add anomaly spike markers if AI interpretation exists
          const spikeDepths =
            interpretation?.stats?.[curve]?.spikeDepths || [];

          if (spikeDepths.length > 0) {
            const spikePoints = data.filter(d =>
              spikeDepths.includes(d.depth)
            );

            traces.push({
              x: spikePoints.map(p => p.depth),
              y: spikePoints.map(p => p.values?.[curve]),
              type: "scatter",
              mode: "markers",
              name: `${curve} Spikes`,
              marker: {
                color: "red",
                size: 8
              },
              yaxis: index === 0 ? "y" : `y${index + 1}`
            });
          }
        });

        return traces;
      })(),
      {
        title: {
          text: "Well Log Curves vs Depth",
          font: { size: 18 }
        },
        paper_bgcolor: "#1e1e1e",
        plot_bgcolor: "#1e1e1e",
        font: { color: "#ffffff" },

        xaxis: {
          title: {
            text: "Depth"
          },
          showline: true,
          linewidth: 2,
          linecolor: "#ffffff",
          mirror: true,
          showgrid: true,
          gridcolor: "#333",
          zeroline: false,
          tickfont: { size: 12 }
        },

        ...Object.fromEntries(
          selectedCurves.map((curve, index) => {
            const axisName = index === 0 ? "yaxis" : `yaxis${index + 1}`;
            return [
              axisName,
              {
                title: { text: curve },
                showline: true,
                linewidth: 2,
                linecolor: "#ffffff",
                mirror: true,
                showgrid: index === 0,
                gridcolor: "#333",
                zeroline: false,
                tickfont: { size: 12 },
                overlaying: index === 0 ? undefined : "y",
                side: index % 2 === 0 ? "left" : "right",
                autorange: false,
                range: axisRangesRef.current[curve],
                fixedrange: true
              }
            ];
          })
        ),

        legend: {
          orientation: "h",
          y: 1.08,
          x: 0.5,
          xanchor: "center"
        },

        height: 700,
        margin: { t: 80, r: 40, b: 70, l: 80 }
      },
      { responsive: true }
    );
  }, [data, selectedCurves, interpretation]);

  useEffect(() => {
    if (!cleanedPlotRef.current) return;
    if (!interpretation || !interpretation.cleanedCurves) return;

    const cleanedCurves = interpretation.cleanedCurves;

    const traces: any[] = [];

    Object.entries(cleanedCurves).forEach(([curveName, curveData]: any) => {
      if (!curveData.depths || !curveData.values) return;

      traces.push({
        x: curveData.depths,
        y: curveData.values,
        type: "scatter",
        mode: "lines",
        name: `${curveName} (Cleaned)`,
        line: { width: 2 }
      });
    });

    if (traces.length === 0) return;

    Plotly.newPlot(
      cleanedPlotRef.current,
      traces,
      {
        title: {
          text: "AI Cleaned Curve (Outliers Removed)",
          font: { size: 18 }
        },
        paper_bgcolor: "#1e1e1e",
        plot_bgcolor: "#1e1e1e",
        font: { color: "#ffffff" },

        xaxis: {
          title: { text: "Depth" },
          showline: true,
          linewidth: 2,
          linecolor: "#ffffff",
          mirror: true,
          showgrid: true,
          gridcolor: "#333",
          zeroline: false,
          tickfont: { size: 12 }
        },

        yaxis: {
          title: { text: "Cleaned Values" },
          showline: true,
          linewidth: 2,
          linecolor: "#ffffff",
          mirror: true,
          showgrid: true,
          gridcolor: "#333",
          zeroline: false,
          tickfont: { size: 12 }
        },

        legend: {
          orientation: "h",
          y: 1.08,
          x: 0.5,
          xanchor: "center"
        },

        height: 500,
        margin: { t: 80, r: 40, b: 70, l: 80 }
      },
      { responsive: true }
    );
  }, [interpretation]);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#1e1e1e" }}>
      
      {/* LEFT SIDE - EXISTING APP */}
      <div style={{ display: "flex", flex: 1 }}>
        
        <div className="sidebar">
          {/* --- EXISTING SIDEBAR CONTENT REMAINS SAME --- */}
          {/* KEEP EVERYTHING YOU ALREADY HAVE INSIDE SIDEBAR */}
          <h2>Well Log Viewer</h2>
          <div className="form-group">
            <label>Upload LAS File</label>
            <input
              type="file"
              accept=".las"
              onChange={e =>
                setSelectedFile(e.target.files ? e.target.files[0] : null)
              }
            />
            <button
              className="btn"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              style={{ marginTop: "8px" }}
            >
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          </div>

          <div className="form-group">
            <label>Well</label>
            <select
              value={selectedWell}
              onChange={e => setSelectedWell(e.target.value)}
            >
              <option value="">Select Well</option>
              {wells.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name || w.id}
                </option>
              ))}
            </select>
            {selectedWell && (
              <button
                className="btn"
                style={{ marginTop: "8px", background: "#b91c1c" }}
                onClick={() => handleDeleteWell(selectedWell)}
              >
                Delete Selected Well
              </button>
            )}
          </div>

          {curves.length > 0 && (
            <div className="form-group">
              <label>Select Curves (min 1, max 3)</label>
              <div style={{ 
                maxHeight: "180px", 
                overflowY: "auto", 
                border: "1px solid #333", 
                padding: "8px", 
                borderRadius: "6px",
                background: "#111"
              }}>
                {curves.map(c => (
                  <div key={c.name} style={{ marginBottom: "6px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedCurves.includes(c.name)}
                        onChange={e => {
                          if (e.target.checked) {
                            if (selectedCurves.length >= 3) return;
                            setSelectedCurves([...selectedCurves, c.name]);
                          } else {
                            setSelectedCurves(selectedCurves.filter(curve => curve !== c.name));
                          }
                        }}
                      />
                      {c.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>From Depth</label>
            <input
              type="number"
              value={fromDepth}
              onChange={e => setFromDepth(Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label>To Depth</label>
            <input
              type="number"
              value={toDepth}
              onChange={e => setToDepth(Number(e.target.value))}
            />
          </div>

          <button className="btn" onClick={fetchData}>
            {loading ? "Loading..." : "Load Data"}
          </button>
          <button
            className="btn"
            style={{ marginTop: "12px", background: "#2563eb" }}
            onClick={runAIInterpretation}
            disabled={data.length === 0}
          >
            AI Interpretation
          </button>
        </div>

        <div className="plot-area">
          <div ref={plotRef} />

          {showAI && interpretation?.cleanedCurves && (
            <div style={{ marginTop: "40px" }}>
              <div ref={cleanedPlotRef} />
            </div>
          )}

          {showAI && interpretation && (
            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                borderRadius: "8px",
                background: "#111",
                border: "1px solid #333",
                color: "#fff"
              }}
            >
              <h3 style={{ marginBottom: "12px" }}>Statistical Interpretation</h3>

              {Object.entries(interpretation.stats || {}).map(
                ([curveName, stats]: any) => (
                  <div
                    key={curveName}
                    style={{
                      marginBottom: "16px",
                      paddingBottom: "12px",
                      borderBottom: "1px solid #333"
                    }}
                  >
                    <h4 style={{ marginBottom: "8px" }}>{curveName}</h4>
                    <p>Median: {stats.median?.toFixed(2)}</p>
                    <p>Mean: {stats.mean?.toFixed(2)}</p>
                    <p>Std Dev: {stats.stdDev?.toFixed(2)}</p>
                    <p>Min: {stats.min?.toFixed(2)}</p>
                    <p>Max: {stats.max?.toFixed(2)}</p>
                  </div>
                )
              )}

              <div style={{ marginTop: "12px" }}>
                <strong>Summary:</strong>
                <p style={{ marginTop: "6px" }}>
                  {interpretation.summary || "No interpretation available."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE - CHATBOT */}
      <div style={{
        width: "350px",
        background: "#111",
        borderLeft: "1px solid #333",
        display: "flex",
        flexDirection: "column"
      }}>
        <div style={{
          padding: "16px",
          borderBottom: "1px solid #333",
          fontWeight: "bold",
          color: "#fff"
        }}>
          Well Chatbot
        </div>

        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px"
        }}>
          {chatMessages.map((msg, index) => (
            <div key={index} style={{
              marginBottom: "12px",
              display: "flex",
              justifyContent: msg.sender === "user" ? "flex-end" : "flex-start"
            }}>
              <div style={{
                padding: "10px 14px",
                borderRadius: "12px",
                maxWidth: "80%",
                background: msg.sender === "user" ? "#2563eb" : "#222",
                color: "#fff",
                fontSize: "14px"
              }}>
                {msg.text}
              </div>
            </div>
          ))}

          {chatLoading && (
            <div style={{ color: "#888", fontSize: "13px" }}>
              Thinking...
            </div>
          )}
        </div>

        <div style={{
          padding: "12px",
          borderTop: "1px solid #333",
          display: "flex",
          gap: "8px"
        }}>
          <input
            type="text"
            placeholder={selectedWell ? "Ask about this well..." : "Select a well first"}
            disabled={!selectedWell}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendChatMessage()}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #444",
              background: "#1e1e1e",
              color: "#fff"
            }}
          />
          <button
            onClick={sendChatMessage}
            disabled={!selectedWell}
            style={{
              padding: "8px 12px",
              background: "#2563eb",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;