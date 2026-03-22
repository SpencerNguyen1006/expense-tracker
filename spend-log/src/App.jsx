import { useState, useEffect, useRef } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonth(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayTotal(transactions) {
  return transactions.reduce((s, t) => s + t.amount, 0);
}

function getMtdTotal(spendings, upToDate) {
  const year = upToDate.getFullYear();
  const month = upToDate.getMonth();
  let total = 0;
  Object.entries(spendings).forEach(([key, txns]) => {
    const d = new Date(key + "T00:00:00");
    if (d.getFullYear() === year && d.getMonth() === month && d <= upToDate) {
      total += dayTotal(txns);
    }
  });
  return total;
}

export default function App() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thisWeekStart = getWeekStart(today);
  const lastWeekStart = addDays(thisWeekStart, -7);

  // spendings: { "2024-03-10": [{ id, amount, desc }], ... }
  const [spendings, setSpendings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("spendings_v2") || "{}");
    } catch {
      return {};
    }
  });

  const [modal, setModal] = useState(null);
  const [input, setInput] = useState("");
  const [desc, setDesc] = useState("");
  const [animDay, setAnimDay] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const amountRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("spendings_v2", JSON.stringify(spendings));
    } catch {}
  }, [spendings]);

  function openModal(date) {
    const key = formatKey(date);
    setModal({ date, key });
    setInput("");
    setDesc("");
    setEditingId(null);
  }

  function closeModal() {
    setModal(null);
    setInput("");
    setDesc("");
    setEditingId(null);
  }

  function addTransaction() {
    const val = parseFloat(input);
    if (isNaN(val) || val <= 0) return;
    const txn = { id: Date.now(), amount: val, desc: desc.trim() };
    setSpendings((prev) => ({
      ...prev,
      [modal.key]: [...(prev[modal.key] || []), txn],
    }));
    setAnimDay(modal.key);
    setTimeout(() => setAnimDay(null), 600);
    setInput("");
    setDesc("");
    setTimeout(() => amountRef.current?.focus(), 50);
  }

  function startEdit(txn) {
    setEditingId(txn.id);
    setInput(txn.amount.toString());
    setDesc(txn.desc);
  }

  function saveEdit() {
    const val = parseFloat(input);
    if (isNaN(val) || val <= 0) { cancelEdit(); return; }
    setSpendings((prev) => ({
      ...prev,
      [modal.key]: (prev[modal.key] || []).map((t) =>
        t.id === editingId ? { ...t, amount: val, desc: desc.trim() } : t
      ),
    }));
    cancelEdit();
  }

  function cancelEdit() {
    setEditingId(null);
    setInput("");
    setDesc("");
  }

  function deleteTransaction(id) {
    setSpendings((prev) => {
      const next = (prev[modal.key] || []).filter((t) => t.id !== id);
      const updated = { ...prev };
      if (next.length === 0) delete updated[modal.key];
      else updated[modal.key] = next;
      return updated;
    });
    if (editingId === id) cancelEdit();
  }

  function weekTotal(weekStart) {
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const key = formatKey(addDays(weekStart, i));
      total += dayTotal(spendings[key] || []);
    }
    return total;
  }

  function renderWeek(weekStart, label) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const total = weekTotal(weekStart);

    return (
      <div style={styles.weekCol}>
        <div style={styles.weekHeader}>
          <span style={styles.weekLabel}>{label}</span>
          <span style={styles.weekRange}>
            {formatMonth(weekStart)} – {formatMonth(addDays(weekStart, 6))}
          </span>
          <span style={styles.weekTotal}>
            {total > 0 ? `$${total.toFixed(2)}` : "—"}
          </span>
        </div>

        <div style={styles.dayList}>
          {days.map((date) => {
            const key = formatKey(date);
            const txns = spendings[key] || [];
            const isToday = formatKey(date) === formatKey(today);
            const isFuture = date > today;
            const isAnim = animDay === key;
            const total = dayTotal(txns);
            const mtd = isFuture ? null : getMtdTotal(spendings, date);

            return (
              <div
                key={key}
                onClick={() => !isFuture && openModal(date)}
                style={{
                  ...styles.dayCard,
                  ...(isToday ? styles.todayCard : {}),
                  ...(isFuture ? styles.futureCard : {}),
                  ...(txns.length > 0 ? styles.hasEntry : {}),
                  ...(isAnim ? styles.animCard : {}),
                  cursor: isFuture ? "default" : "pointer",
                }}
              >
                <div style={styles.dayRow}>
                  <span style={{ ...styles.dayName, ...(isToday ? styles.todayText : {}) }}>
                    {DAYS[date.getDay()]}
                  </span>
                  <span style={styles.dayNum}>{date.getDate()}</span>
                </div>

                <div style={styles.cardBottom}>
                  <div style={styles.entryBlock}>
                    {txns.length > 0 ? (
                      <>
                        <span style={styles.amount}>${total.toFixed(2)}</span>
                        <span style={styles.txnCount}>
                          {txns.length} {txns.length === 1 ? "txn" : "txns"}
                        </span>
                      </>
                    ) : (
                      !isFuture && <span style={styles.addHint}>+ add</span>
                    )}
                  </div>

                  {!isFuture && mtd > 0 && (
                    <div style={styles.mtdBlock}>
                      <span style={styles.mtdValue}>${mtd.toFixed(0)}</span>
                      <span style={styles.mtdLabel}>MTD</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const modalTxns = modal ? (spendings[modal.key] || []) : [];
  const modalTotal = dayTotal(modalTxns);

  return (
    <div style={styles.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0e0c; }
        input::placeholder { color: #5a5650; }
        input:focus { outline: none; border-color: #e8c97e !important; }
        .modal-overlay { animation: fadeIn 0.15s ease; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .modal-box { animation: slideUp 0.2s ease; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.03) } }
        .txn-row:hover .txn-actions { opacity: 1 !important; }
        .txn-row:hover { border-color: #3a3830 !important; }
      `}</style>

      <div style={styles.header}>
        <h1 style={styles.title}>Spend<br />Log</h1>
        <p style={styles.subtitle}>
          {today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div style={styles.columns}>
        {renderWeek(lastWeekStart, "Last Week")}
        <div style={styles.divider} />
        {renderWeek(thisWeekStart, "This Week")}
      </div>

      {modal && (
        <div
          className="modal-overlay"
          style={styles.overlay}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal-box" style={styles.modalBox}>
            {/* Header */}
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalDay}>
                  {modal.date.toLocaleDateString("en-US", { weekday: "long" })}
                </div>
                <div style={styles.modalDate}>
                  {modal.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              {modalTotal > 0 && (
                <div style={styles.modalSummary}>
                  <div style={styles.modalTotalAmt}>${modalTotal.toFixed(2)}</div>
                  <div style={styles.modalTotalCount}>
                    {modalTxns.length} {modalTxns.length === 1 ? "transaction" : "transactions"}
                  </div>
                </div>
              )}
            </div>

            {/* Transaction list */}
            {modalTxns.length > 0 && (
              <div style={styles.txnList}>
                {modalTxns.map((txn) => (
                  <div key={txn.id} className="txn-row" style={styles.txnRow}>
                    {editingId === txn.id ? (
                      <div style={styles.inlineEdit}>
                        <input
                          style={{ ...styles.input, fontSize: 13, padding: "8px 10px" }}
                          type="number"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          autoFocus
                        />
                        <input
                          style={{ ...styles.input, fontSize: 13, padding: "8px 10px" }}
                          type="text"
                          placeholder="Note…"
                          value={desc}
                          onChange={(e) => setDesc(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ ...styles.saveBtn, padding: "7px 12px", fontSize: 11 }} onClick={saveEdit}>Save</button>
                          <button style={{ ...styles.cancelBtn, padding: "7px 12px", fontSize: 11 }} onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={styles.txnInfo}>
                          <span style={styles.txnAmount}>${txn.amount.toFixed(2)}</span>
                          {txn.desc && <span style={styles.txnDesc}>{txn.desc}</span>}
                        </div>
                        <div className="txn-actions" style={{ ...styles.txnActions, opacity: 0 }}>
                          <button style={styles.iconBtn} onClick={() => startEdit(txn)} title="Edit">✎</button>
                          <button style={{ ...styles.iconBtn, color: "#c0614a" }} onClick={() => deleteTransaction(txn.id)} title="Delete">✕</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add new transaction */}
            {editingId === null && (
              <div style={styles.addSection}>
                <div style={styles.addSectionLabel}>
                  {modalTxns.length === 0 ? "Add a transaction" : "Add another"}
                </div>
                <input
                  ref={amountRef}
                  style={styles.input}
                  type="number"
                  inputMode="decimal"
                  placeholder="Amount ($)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTransaction()}
                  autoFocus={modalTxns.length === 0}
                />
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Note (optional)"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTransaction()}
                />
                <div style={styles.modalActions}>
                  <button style={styles.cancelBtn} onClick={closeModal}>Done</button>
                  <button style={styles.saveBtn} onClick={addTransaction}>Add</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    fontFamily: "'DM Mono', monospace",
    background: "#0f0e0c",
    minHeight: "100vh",
    color: "#e8e4dc",
    maxWidth: 480,
    margin: "0 auto",
    padding: "0 0 40px",
  },
  header: {
    padding: "32px 24px 20px",
    borderBottom: "1px solid #2a2824",
  },
  title: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 48,
    lineHeight: 1.05,
    color: "#e8c97e",
    letterSpacing: "-1px",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 11,
    color: "#6b6660",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "1fr 2px 1fr",
    padding: "0 8px",
  },
  divider: {
    background: "#2a2824",
    margin: "16px 0",
  },
  weekCol: {
    padding: "16px 8px",
  },
  weekHeader: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: "1px solid #2a2824",
  },
  weekLabel: {
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#8b8680",
  },
  weekRange: {
    fontSize: 10,
    color: "#5a5650",
  },
  weekTotal: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 20,
    color: "#e8c97e",
    marginTop: 2,
  },
  dayList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  dayCard: {
    background: "#1a1916",
    border: "1px solid #2a2824",
    borderRadius: 8,
    padding: "10px",
    transition: "border-color 0.15s, background 0.15s",
    minHeight: 64,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  todayCard: {
    borderColor: "#e8c97e44",
    background: "#1e1d18",
  },
  futureCard: {
    opacity: 0.3,
  },
  hasEntry: {
    borderColor: "#e8c97e66",
    background: "#1d1c17",
  },
  animCard: {
    animation: "pulse 0.6s ease",
  },
  dayRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayName: {
    fontSize: 11,
    letterSpacing: "0.08em",
    color: "#6b6660",
    textTransform: "uppercase",
  },
  todayText: {
    color: "#e8c97e",
  },
  dayNum: {
    fontSize: 13,
    color: "#8b8680",
  },
  entryBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  amount: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 16,
    color: "#e8e4dc",
    lineHeight: 1.2,
  },
  txnCount: {
    fontSize: 9,
    color: "#6b6660",
    letterSpacing: "0.06em",
  },
  addHint: {
    fontSize: 10,
    color: "#3a3830",
    letterSpacing: "0.05em",
  },
  cardBottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flex: 1,
  },
  mtdBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 1,
  },
  mtdValue: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: "#e8c97e",
    lineHeight: 1.2,
    letterSpacing: "0.02em",
  },
  mtdLabel: {
    fontSize: 8,
    color: "#a8894e",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.78)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 100,
    padding: 16,
  },
  modalBox: {
    background: "#1a1916",
    border: "1px solid #2a2824",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 440,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxHeight: "85vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  modalDay: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 22,
    color: "#e8c97e",
  },
  modalDate: {
    fontSize: 11,
    color: "#6b6660",
    letterSpacing: "0.08em",
    marginTop: 2,
  },
  modalSummary: {
    textAlign: "right",
  },
  modalTotalAmt: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 22,
    color: "#e8e4dc",
  },
  modalTotalCount: {
    fontSize: 10,
    color: "#6b6660",
    letterSpacing: "0.06em",
    marginTop: 2,
  },
  txnList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    borderTop: "1px solid #2a2824",
    borderBottom: "1px solid #2a2824",
    paddingTop: 12,
    paddingBottom: 12,
  },
  txnRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    borderRadius: 6,
    background: "#111009",
    border: "1px solid #222120",
    transition: "border-color 0.1s",
    gap: 8,
  },
  txnInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  txnAmount: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 15,
    color: "#e8e4dc",
  },
  txnDesc: {
    fontSize: 10,
    color: "#6b6660",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    letterSpacing: "0.04em",
  },
  txnActions: {
    display: "flex",
    gap: 4,
    transition: "opacity 0.15s",
    flexShrink: 0,
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    color: "#6b6660",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 5px",
    borderRadius: 4,
    fontFamily: "inherit",
  },
  inlineEdit: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
  },
  addSection: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  addSectionLabel: {
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#6b6660",
  },
  input: {
    background: "#111009",
    border: "1px solid #2a2824",
    borderRadius: 8,
    padding: "12px 14px",
    color: "#e8e4dc",
    fontFamily: "'DM Mono', monospace",
    fontSize: 15,
    width: "100%",
    transition: "border-color 0.15s",
  },
  modalActions: {
    display: "flex",
    gap: 8,
  },
  saveBtn: {
    flex: 1,
    background: "#e8c97e",
    color: "#0f0e0c",
    border: "none",
    borderRadius: 8,
    padding: "12px",
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    letterSpacing: "0.06em",
  },
  cancelBtn: {
    flex: 1,
    background: "transparent",
    color: "#6b6660",
    border: "1px solid #2a2824",
    borderRadius: 8,
    padding: "12px",
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    cursor: "pointer",
    letterSpacing: "0.06em",
  },
};
