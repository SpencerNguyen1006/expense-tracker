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

// Get all weeks that overlap with the current month
function getMonthWeeks(today) {
  const year = today.getFullYear();
  const month = today.getMonth();

  // First and last day of the month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from the Sunday of the first week
  const start = getWeekStart(firstDay);
  const weeks = [];

  let current = new Date(start);
  while (current <= lastDay) {
    weeks.push(new Date(current));
    current = addDays(current, 7);
  }
  return weeks;
}

function buildSpendingContext(spendings, today) {
  const lines = [];
  lines.push(`Today is ${today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`);
  const mtd = getMtdTotal(spendings, today);
  lines.push(`Month-to-date total spending: $${mtd.toFixed(2)}.`);
  const allEntries = Object.entries(spendings).sort(([a], [b]) => a.localeCompare(b));
  if (allEntries.length === 0) {
    lines.push("No transactions recorded yet.");
  } else {
    lines.push("\nAll recorded transactions:");
    allEntries.forEach(([key, txns]) => {
      const d = new Date(key + "T00:00:00");
      const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const daySum = dayTotal(txns);
      lines.push(`\n${label} (total: $${daySum.toFixed(2)}):`);
      txns.forEach(t => {
        const sign = t.amount < 0 ? "" : "";
        lines.push(`  - $${t.amount.toFixed(2)}${t.desc ? ` (${t.desc})` : ""}${t.amount < 0 ? " [credit]" : ""}`);
      });
    });
  }
  return lines.join("\n");
}

async function askClaude(question, spendings, today) {
  const context = buildSpendingContext(spendings, today);
  const systemPrompt = `You are a spending assistant built into a personal spending tracker app called Spend Log.
You have access to the user's spending data below. Answer questions about their spending concisely and helpfully.
Only answer questions about their spending data. If asked anything unrelated, politely redirect them.
Keep answers short — 1 to 3 sentences max unless a breakdown is needed.
Always use dollar signs and format numbers to 2 decimal places.
Negative amounts represent credits or refunds.

SPENDING DATA:
${context}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text || "Sorry, I couldn't get a response.";
}

// ─── Chatbot ──────────────────────────────────────────────────────────────────

function Chatbot({ spendings, today }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! Ask me anything about your spending 💸" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);
    try {
      const answer = await askClaude(q, spendings, today);
      setMessages(prev => [...prev, { role: "assistant", text: answer }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Something went wrong. Please try again." }]);
    }
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ ...cs.fab, background: open ? "#2a2824" : "#e8c97e", color: open ? "#e8c97e" : "#0f0e0c" }}
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div style={cs.panel}>
          <div style={cs.panelHeader}>
            <span style={cs.panelTitle}>Spend Assistant</span>
            <span style={cs.panelSub}>Ask about your spending</span>
          </div>
          <div style={cs.messages}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ ...cs.bubble, ...(m.role === "user" ? cs.userBubble : cs.aiBubble) }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ ...cs.bubble, ...cs.aiBubble, color: "#6b6660" }}>thinking…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={cs.inputRow}>
            <input
              style={cs.chatInput}
              placeholder="Ask about your spending…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              autoFocus
            />
            <button style={cs.sendBtn} onClick={send} disabled={loading}>↑</button>
          </div>
          <div style={cs.quickRow}>
            {["This week total?", "MTD total?", "Biggest expense?"].map(q => (
              <button key={q} style={cs.quickBtn} onClick={() => setInput(q)}>{q}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weeks = getMonthWeeks(today);

  const [spendings, setSpendings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("spendings_v2") || "{}"); }
    catch { return {}; }
  });

  const [modal, setModal] = useState(null);
  const [input, setInput] = useState("");
  const [desc, setDesc] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [animDay, setAnimDay] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const amountRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem("spendings_v2", JSON.stringify(spendings)); }
    catch {}
  }, [spendings]);

  function openModal(date) {
    setModal({ date, key: formatKey(date) });
    setInput(""); setDesc(""); setIsCredit(false); setEditingId(null);
  }

  function closeModal() {
    setModal(null);
    setInput(""); setDesc(""); setIsCredit(false); setEditingId(null);
  }

  function addTransaction() {
    const val = parseFloat(input);
    if (isNaN(val) || val <= 0) return;
    const amount = isCredit ? -val : val;
    const txn = { id: Date.now(), amount, desc: desc.trim() };
    setSpendings(prev => ({ ...prev, [modal.key]: [...(prev[modal.key] || []), txn] }));
    setAnimDay(modal.key);
    setTimeout(() => setAnimDay(null), 600);
    setInput(""); setDesc(""); setIsCredit(false);
    setTimeout(() => amountRef.current?.focus(), 50);
  }

  function startEdit(txn) {
    setEditingId(txn.id);
    setInput(Math.abs(txn.amount).toString());
    setDesc(txn.desc);
    setIsCredit(txn.amount < 0);
  }

  function saveEdit() {
    const val = parseFloat(input);
    if (isNaN(val) || val <= 0) { cancelEdit(); return; }
    const amount = isCredit ? -val : val;
    setSpendings(prev => ({
      ...prev,
      [modal.key]: (prev[modal.key] || []).map(t =>
        t.id === editingId ? { ...t, amount, desc: desc.trim() } : t
      ),
    }));
    cancelEdit();
  }

  function cancelEdit() {
    setEditingId(null); setInput(""); setDesc(""); setIsCredit(false);
  }

  function deleteTransaction(id) {
    setSpendings(prev => {
      const next = (prev[modal.key] || []).filter(t => t.id !== id);
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
      total += dayTotal(spendings[formatKey(addDays(weekStart, i))] || []);
    }
    return total;
  }

  // Check if a week has any days in the current month
  function weekLabel(weekStart) {
    const month = today.getMonth();
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const monthDays = days.filter(d => d.getMonth() === month);
    const first = monthDays[0];
    const last = monthDays[monthDays.length - 1];
    return `${formatMonth(first)} – ${formatMonth(last)}`;
  }

  function renderWeek(weekStart, weekIndex) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const total = weekTotal(weekStart);
    const month = today.getMonth();

    return (
      <div key={formatKey(weekStart)} style={styles.weekSection}>
        <div style={styles.weekHeader}>
          <span style={styles.weekLabel}>Week {weekIndex + 1}</span>
          <span style={styles.weekRange}>{weekLabel(weekStart)}</span>
          <span style={{
            ...styles.weekTotal,
            color: total < 0 ? "#7ec97e" : "#e8c97e"
          }}>
            {total !== 0 ? `${total < 0 ? "-" : ""}$${Math.abs(total).toFixed(2)}` : "—"}
          </span>
        </div>

        <div style={styles.dayGrid}>
          {days.map((date) => {
            const key = formatKey(date);
            const txns = spendings[key] || [];
            const isToday = formatKey(date) === formatKey(today);
            const isFuture = date > today;
            const isOtherMonth = date.getMonth() !== month;
            const isAnim = animDay === key;
            const total = dayTotal(txns);
            const mtd = isFuture ? null : getMtdTotal(spendings, date);
            const isCredit = total < 0;

            return (
              <div
                key={key}
                onClick={() => !isFuture && !isOtherMonth && openModal(date)}
                style={{
                  ...styles.dayCard,
                  ...(isToday ? styles.todayCard : {}),
                  ...(isFuture || isOtherMonth ? styles.futureCard : {}),
                  ...(txns.length > 0 && !isOtherMonth ? (isCredit ? styles.creditEntry : styles.hasEntry) : {}),
                  ...(isAnim ? styles.animCard : {}),
                  cursor: isFuture || isOtherMonth ? "default" : "pointer",
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
                    {txns.length > 0 && !isOtherMonth ? (
                      <>
                        <span style={{ ...styles.amount, color: isCredit ? "#7ec97e" : "#e8e4dc" }}>
                          {isCredit ? "-" : ""}${Math.abs(total).toFixed(2)}
                        </span>
                        <span style={styles.txnCount}>
                          {txns.length} {txns.length === 1 ? "txn" : "txns"}
                        </span>
                      </>
                    ) : (
                      !isFuture && !isOtherMonth && <span style={styles.addHint}>+ add</span>
                    )}
                  </div>

                  {!isFuture && !isOtherMonth && mtd !== null && mtd !== 0 && (
                    <div style={styles.mtdBlock}>
                      <span style={{ ...styles.mtdValue, color: mtd < 0 ? "#7ec97e" : "#e8c97e" }}>
                        {mtd < 0 ? "-" : ""}${Math.abs(mtd).toFixed(0)}
                      </span>
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
        .credit-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .credit-toggle input { accent-color: #7ec97e; width: 16px; height: 16px; cursor: pointer; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Spend<br />Log</h1>
        <div style={styles.headerRight}>
          <p style={styles.subtitle}>
            {today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <p style={styles.mtdHeader}>
            MTD: <span style={{
              color: getMtdTotal(spendings, today) < 0 ? "#7ec97e" : "#e8c97e"
            }}>${getMtdTotal(spendings, today).toFixed(2)}</span>
          </p>
        </div>
      </div>

      {/* Weeks */}
      <div style={styles.weeksContainer}>
        {weeks.map((weekStart, i) => renderWeek(weekStart, i))}
      </div>

      {/* Chatbot */}
      <Chatbot spendings={spendings} today={today} />

      {/* Modal */}
      {modal && (
        <div
          className="modal-overlay"
          style={styles.overlay}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal-box" style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalDay}>
                  {modal.date.toLocaleDateString("en-US", { weekday: "long" })}
                </div>
                <div style={styles.modalDate}>
                  {modal.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              {modalTxns.length > 0 && (
                <div style={styles.modalSummary}>
                  <div style={{ ...styles.modalTotalAmt, color: modalTotal < 0 ? "#7ec97e" : "#e8e4dc" }}>
                    {modalTotal < 0 ? "-" : ""}${Math.abs(modalTotal).toFixed(2)}
                  </div>
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
                          onChange={e => setInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          autoFocus
                        />
                        <input
                          style={{ ...styles.input, fontSize: 13, padding: "8px 10px" }}
                          type="text"
                          placeholder="Note…"
                          value={desc}
                          onChange={e => setDesc(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        />
                        <label className="credit-toggle">
                          <input
                            type="checkbox"
                            checked={isCredit}
                            onChange={e => setIsCredit(e.target.checked)}
                          />
                          <span style={{ fontSize: 11, color: isCredit ? "#7ec97e" : "#6b6660" }}>
                            Credit / Refund
                          </span>
                        </label>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ ...styles.saveBtn, padding: "7px 12px", fontSize: 11 }} onClick={saveEdit}>Save</button>
                          <button style={{ ...styles.cancelBtn, padding: "7px 12px", fontSize: 11 }} onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={styles.txnInfo}>
                          <span style={{ ...styles.txnAmount, color: txn.amount < 0 ? "#7ec97e" : "#e8e4dc" }}>
                            {txn.amount < 0 ? "-" : ""}${Math.abs(txn.amount).toFixed(2)}
                            {txn.amount < 0 && <span style={{ fontSize: 9, marginLeft: 4, color: "#5a9a5a" }}>credit</span>}
                          </span>
                          {txn.desc && <span style={styles.txnDesc}>{txn.desc}</span>}
                        </div>
                        <div className="txn-actions" style={{ ...styles.txnActions, opacity: 0 }}>
                          <button style={styles.iconBtn} onClick={() => startEdit(txn)}>✎</button>
                          <button style={{ ...styles.iconBtn, color: "#c0614a" }} onClick={() => deleteTransaction(txn.id)}>✕</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add transaction */}
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
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTransaction()}
                  autoFocus={modalTxns.length === 0}
                />
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Note (optional)"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTransaction()}
                />
                <label className="credit-toggle">
                  <input
                    type="checkbox"
                    checked={isCredit}
                    onChange={e => setIsCredit(e.target.checked)}
                  />
                  <span style={{ fontSize: 11, color: isCredit ? "#7ec97e" : "#6b6660" }}>
                    Credit / Refund
                  </span>
                </label>
                <div style={styles.modalActions}>
                  <button style={styles.cancelBtn} onClick={closeModal}>Done</button>
                  <button style={{
                    ...styles.saveBtn,
                    background: isCredit ? "#7ec97e" : "#e8c97e",
                  }} onClick={addTransaction}>
                    {isCredit ? "Add Credit" : "Add"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chatbot Styles ───────────────────────────────────────────────────────────

const cs = {
  fab: {
    position: "fixed", bottom: 24, right: 24, width: 52, height: 52,
    borderRadius: "50%", border: "none", fontSize: 22, cursor: "pointer",
    zIndex: 200, boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    transition: "background 0.2s, color 0.2s",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  panel: {
    position: "fixed", bottom: 88, right: 16, width: 320,
    maxWidth: "calc(100vw - 32px)", background: "#1a1916",
    border: "1px solid #2a2824", borderRadius: 16, zIndex: 199,
    display: "flex", flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,0.6)", overflow: "hidden",
  },
  panelHeader: { padding: "14px 16px 12px", borderBottom: "1px solid #2a2824" },
  panelTitle: { fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#e8c97e", display: "block" },
  panelSub: { fontSize: 10, color: "#6b6660", letterSpacing: "0.08em" },
  messages: { padding: "12px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" },
  bubble: { maxWidth: "85%", padding: "8px 12px", borderRadius: 10, fontSize: 12, lineHeight: 1.5, fontFamily: "'DM Mono', monospace" },
  aiBubble: { background: "#111009", border: "1px solid #2a2824", color: "#e8e4dc", borderBottomLeftRadius: 2 },
  userBubble: { background: "#e8c97e", color: "#0f0e0c", borderBottomRightRadius: 2 },
  inputRow: { display: "flex", gap: 6, padding: "8px 10px", borderTop: "1px solid #2a2824" },
  chatInput: {
    flex: 1, background: "#111009", border: "1px solid #2a2824", borderRadius: 8,
    padding: "8px 10px", color: "#e8e4dc", fontFamily: "'DM Mono', monospace", fontSize: 12,
  },
  sendBtn: { background: "#e8c97e", color: "#0f0e0c", border: "none", borderRadius: 8, width: 34, fontWeight: 700, fontSize: 16, cursor: "pointer" },
  quickRow: { display: "flex", gap: 6, padding: "0 10px 10px", flexWrap: "wrap" },
  quickBtn: {
    background: "transparent", border: "1px solid #2a2824", borderRadius: 20,
    padding: "4px 10px", color: "#6b6660", fontSize: 10, cursor: "pointer",
    fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em",
  },
};

// ─── App Styles ───────────────────────────────────────────────────────────────

const styles = {
  root: {
    fontFamily: "'DM Mono', monospace", background: "#0f0e0c",
    minHeight: "100vh", color: "#e8e4dc", maxWidth: 480,
    margin: "0 auto", padding: "0 0 80px",
  },
  header: {
    padding: "32px 24px 20px", borderBottom: "1px solid #2a2824",
    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
  },
  headerRight: { textAlign: "right" },
  title: {
    fontFamily: "'DM Serif Display', serif", fontSize: 48,
    lineHeight: 1.05, color: "#e8c97e", letterSpacing: "-1px",
  },
  subtitle: { fontSize: 11, color: "#6b6660", letterSpacing: "0.12em", textTransform: "uppercase" },
  mtdHeader: { fontSize: 11, color: "#6b6660", marginTop: 4, letterSpacing: "0.06em" },
  weeksContainer: { padding: "0 8px" },
  weekSection: { marginTop: 20 },
  weekHeader: {
    display: "flex", flexDirection: "column", gap: 2,
    marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #2a2824",
  },
  weekLabel: { fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8b8680" },
  weekRange: { fontSize: 10, color: "#5a5650" },
  weekTotal: { fontFamily: "'DM Serif Display', serif", fontSize: 20, marginTop: 2 },
  dayGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  dayCard: {
    background: "#1a1916", border: "1px solid #2a2824", borderRadius: 6,
    padding: "6px 5px", transition: "border-color 0.15s, background 0.15s",
    minHeight: 64, display: "flex", flexDirection: "column", gap: 3,
  },
  todayCard: { borderColor: "#e8c97e44", background: "#1e1d18" },
  futureCard: { opacity: 0.3 },
  hasEntry: { borderColor: "#e8c97e66", background: "#1d1c17" },
  creditEntry: { borderColor: "#7ec97e66", background: "#141a14" },
  animCard: { animation: "pulse 0.6s ease" },
  dayRow: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1 },
  dayName: { fontSize: 8, letterSpacing: "0.06em", color: "#6b6660", textTransform: "uppercase" },
  todayText: { color: "#e8c97e" },
  dayNum: { fontSize: 12, color: "#8b8680" },
  cardBottom: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "flex-end" },
  entryBlock: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1 },
  amount: { fontSize: 10, color: "#e8e4dc", lineHeight: 1.2, textAlign: "center" },
  txnCount: { fontSize: 8, color: "#6b6660" },
  addHint: { fontSize: 9, color: "#3a3830" },
  mtdBlock: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1, marginTop: 2 },
  mtdValue: { fontSize: 8, lineHeight: 1.2 },
  mtdLabel: { fontSize: 7, color: "#a8894e", letterSpacing: "0.1em", textTransform: "uppercase" },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, padding: 16,
  },
  modalBox: {
    background: "#1a1916", border: "1px solid #2a2824", borderRadius: 16,
    padding: 24, width: "100%", maxWidth: 440, display: "flex",
    flexDirection: "column", gap: 16, maxHeight: "85vh", overflowY: "auto",
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  modalDay: { fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#e8c97e" },
  modalDate: { fontSize: 11, color: "#6b6660", letterSpacing: "0.08em", marginTop: 2 },
  modalSummary: { textAlign: "right" },
  modalTotalAmt: { fontFamily: "'DM Serif Display', serif", fontSize: 22 },
  modalTotalCount: { fontSize: 10, color: "#6b6660", letterSpacing: "0.06em", marginTop: 2 },
  txnList: {
    display: "flex", flexDirection: "column", gap: 4,
    borderTop: "1px solid #2a2824", borderBottom: "1px solid #2a2824",
    paddingTop: 12, paddingBottom: 12,
  },
  txnRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 10px", borderRadius: 6, background: "#111009",
    border: "1px solid #222120", transition: "border-color 0.1s", gap: 8,
  },
  txnInfo: { display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 },
  txnAmount: { fontFamily: "'DM Serif Display', serif", fontSize: 15 },
  txnDesc: { fontSize: 10, color: "#6b6660", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "0.04em" },
  txnActions: { display: "flex", gap: 4, transition: "opacity 0.15s", flexShrink: 0 },
  iconBtn: { background: "transparent", border: "none", color: "#6b6660", cursor: "pointer", fontSize: 14, padding: "2px 5px", borderRadius: 4, fontFamily: "inherit" },
  inlineEdit: { display: "flex", flexDirection: "column", gap: 8, width: "100%" },
  addSection: { display: "flex", flexDirection: "column", gap: 10 },
  addSectionLabel: { fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b6660" },
  input: {
    background: "#111009", border: "1px solid #2a2824", borderRadius: 8,
    padding: "12px 14px", color: "#e8e4dc", fontFamily: "'DM Mono', monospace",
    fontSize: 15, width: "100%", transition: "border-color 0.15s",
  },
  modalActions: { display: "flex", gap: 8 },
  saveBtn: {
    flex: 1, border: "none", borderRadius: 8, padding: "12px",
    fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500,
    cursor: "pointer", letterSpacing: "0.06em", color: "#0f0e0c",
  },
  cancelBtn: {
    flex: 1, background: "transparent", color: "#6b6660", border: "1px solid #2a2824",
    borderRadius: 8, padding: "12px", fontFamily: "'DM Mono', monospace",
    fontSize: 13, cursor: "pointer", letterSpacing: "0.06em",
  },
};
