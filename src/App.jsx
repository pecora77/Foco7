import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./supabase.js";

// ─── Palette & fonts via inline style injection ──────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0d14;
      --surface: #111520;
      --surface2: #171c2e;
      --border: #1e2540;
      --accent: #4fffb0;
      --accent2: #ff6b6b;
      --accent3: #ffd166;
      --accent4: #74b9ff;
      --text: #e8eaf6;
      --muted: #5a6080;
      --font-head: 'Syne', sans-serif;
      --font-mono: 'DM Mono', monospace;
    }
    body { background: var(--bg); color: var(--text); font-family: var(--font-mono); }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
    input, select, textarea {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      font-family: var(--font-mono);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 13px;
      outline: none;
      transition: border-color .2s;
    }
    input:focus, select:focus { border-color: var(--accent); }
    button { cursor: pointer; font-family: var(--font-mono); transition: all .15s; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .fade-in { animation: fadeIn .3s ease both; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
    .loading { animation: pulse 1.5s infinite; }
    @keyframes slideUp { from { transform:translateY(40px); opacity:0; } to { transform:translateY(0); opacity:1; } }

    /* ── Inputs maiores para toque ── */
    input, select, textarea { font-size: 16px; padding: 12px 14px; border-radius: 8px; }

    /* ── Bottom nav (só mobile) ── */
    .bottom-nav {
      display: none;
      position: fixed; bottom: 0; left: 0; right: 0;
      height: 62px; background: var(--surface);
      border-top: 1px solid var(--border); z-index: 200;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .top-tabs { display: flex; }

    /* ── Modal como bottom sheet no mobile ── */
    @media (max-width: 680px) {
      .bottom-nav { display: flex; align-items: center; justify-content: space-around; }
      .top-tabs, .top-logout { display: none !important; }
      .page-pad { padding: 16px 12px; padding-bottom: calc(78px + env(safe-area-inset-bottom)) !important; }
      .modal-overlay { align-items: flex-end !important; padding: 0 !important; }
      .modal-box {
        border-radius: 20px 20px 0 0 !important;
        max-width: 100% !important; min-width: 0 !important;
        max-height: 90vh; overflow-y: auto;
        animation: slideUp .25s ease both !important;
      }
      .grid-2 { grid-template-columns: 1fr !important; }
      .stat-grid { grid-template-columns: repeat(2,1fr) !important; }
      table th, table td { padding: 7px 8px !important; font-size: 12px !important; }
      .hide-m { display: none !important; }
    }
  `}</style>
);

// ─── Dados iniciais (vazio para novos usuários) ───────────────────────────────
const SEED = {
  gastoFixo: [],
  contaFixa: [],
  gastoVar: [],
  saldos: [],
  devedores: [],
  faturas: { bancos: [], itens: {}, fechadas: {} },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const brl = (v) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sum = (arr, key = "valor") => arr.reduce((a, b) => a + (Number(b[key]) || 0), 0);
const nextId = (arr) => (arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1);

// ─── Date auto-mask: formats as DD/MM/AA while typing ────────────────────────
const maskDate = (val) => {
  const digits = val.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0,2)}/${digits.slice(2)}`;
  return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
};

// ─── Apostrophe devedor detection ─────────────────────────────────────────────
// Detecta 'NOME em qualquer posição da descrição
// Retorna { nome, descLimpa } ou null
const extractDevedor = (desc) => {
  const m = desc.match(/'([A-ZÀ-Úa-zà-ú][A-ZÀ-Úa-zà-ú0-9 ]*)/);
  if (!m) return null;
  const nome = m[1].trim().toUpperCase();
  const descLimpa = desc.replace(m[0], "").trim();
  return { nome, descLimpa };
};

// ─── Relógio Brasília + mês atual ────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Mapeia mês/ano real → label do array MESES
const getMesAtual = () => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const mes = now.getMonth(); // 0=Jan
  const ano = now.getFullYear();
  const labels = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const anoSuffix = String(ano).slice(2); // "26"
  return `${labels[mes]}/${anoSuffix}`; // ex: "MAR/26"
};

// ─── Drag-and-drop hook ───────────────────────────────────────────────────────
function useDragSort(items, onReorder) {
  const dragIdx = useRef(null);
  const onDragStart = (i) => { dragIdx.current = i; };
  const onDragOver = (e, i) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const next = [...items];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(i, 0, moved);
    dragIdx.current = i;
    onReorder(next);
  };
  const onDragEnd = () => { dragIdx.current = null; };
  return { onDragStart, onDragOver, onDragEnd };
}

// ─── Supabase storage hook (por usuário) ─────────────────────────────────────
function useStorage(key, fallback, userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setData(fallback); setLoading(false); return; }
    setData(null);
    setLoading(true);
    (async () => {
      try {
        const rowId = `${userId}:${key}`;
        const { data: rows } = await supabase
          .from("app_data")
          .select("payload")
          .eq("id", rowId)
          .eq("user_id", userId)
          .single();
        setData(rows ? rows.payload : fallback);
      } catch {
        setData(fallback);
      }
      setLoading(false);
    })();
  }, [key, userId]);

  const save = useCallback(async (val) => {
    setData(val);
    try {
      if (!userId) return;
      const rowId = `${userId}:${key}`;
      await supabase.from("app_data").upsert({
        id: rowId,
        user_id: userId,
        payload: val,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Erro ao salvar:", e);
    }
  }, [key, userId]);

  return [data, save, loading];
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Icons = {
  dashboard: (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  gastos:    (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  saldos:    (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
  devedores: (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  faturas:   (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  logout:    (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  trash:     (c="#ff6b6b") => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  edit:      (c="var(--accent4)") => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  eyeOn:     (c="var(--muted)") => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:    (c="#ff6b6b") => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  bell:      (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
};

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel, requireText }) {
  const [typed, setTyped] = useState("");
  const canConfirm = requireText ? typed === requireText : true;
  return createPortal(
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "#00000099", zIndex: 2000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", overflowY: "auto",
    }}>
      <div className="fade-in" style={{
        background: "var(--surface2)", border: "1px solid #ff6b6b44",
        borderRadius: 14, padding: 28, maxWidth: 400, width: "100%",
        margin: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 15, color: "#ff6b6b" }}>{title}</h3>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: requireText ? 16 : 24, lineHeight: 1.6 }}>{message}</p>
        {requireText && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Digite <span style={{ color: "#ff6b6b", fontWeight: 700 }}>{requireText}</span> para confirmar
            </label>
            <input
              autoFocus
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={requireText}
              style={{ width: "100%", borderColor: typed === requireText ? "var(--accent)" : "var(--border)" }}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, background: "var(--surface)", border: "1px solid var(--border)",
            color: "var(--muted)", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontFamily: "var(--font-mono)"
          }}>Cancelar</button>
          <button onClick={onConfirm} disabled={!canConfirm} style={{
            flex: 1, background: canConfirm ? "#ff6b6b22" : "var(--surface)",
            border: `1px solid ${canConfirm ? "#ff6b6b44" : "var(--border)"}`,
            color: canConfirm ? "#ff6b6b" : "var(--muted)",
            borderRadius: 6, padding: "8px 16px", fontSize: 13, fontFamily: "var(--font-mono)",
            cursor: canConfirm ? "pointer" : "not-allowed", fontWeight: 600,
          }}>Excluir</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = ({ title, message, requireText, onConfirm }) => setState({ title, message, requireText, onConfirm });
  const dialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      requireText={state.requireText}
      onConfirm={() => { state.onConfirm(); setState(null); }}
      onCancel={() => setState(null)}
    />
  ) : null;
  return [confirm, dialog];
}

// ─── Mini components ──────────────────────────────────────────────────────────
const Card = ({ children, style }) => (
  <div style={{
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 12, padding: 20, ...style
  }}>{children}</div>
);

const Tag = ({ color, children }) => (
  <span style={{
    background: color + "22", color, border: `1px solid ${color}44`,
    borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 500,
    whiteSpace: "nowrap"
  }}>{children}</span>
);

const Btn = ({ onClick, children, color = "var(--accent)", small, danger, style }) => (
  <button onClick={onClick} style={{
    background: danger ? "#ff6b6b22" : color + "18",
    border: `1px solid ${danger ? "#ff6b6b" : color}44`,
    color: danger ? "#ff6b6b" : color,
    borderRadius: 6, padding: small ? "4px 10px" : "8px 16px",
    fontSize: small ? 12 : 13, fontWeight: 500,
    ...style,
  }}
    onMouseOver={e => e.currentTarget.style.background = (danger ? "#ff6b6b" : color) + "30"}
    onMouseOut={e => e.currentTarget.style.background = (danger ? "#ff6b6b" : color) + "18"}
  >{children}</button>
);

const StatBox = ({ label, value, color = "var(--accent)", sub }) => (
  <div style={{ background: "var(--surface2)", border: `1px solid ${color}33`, borderRadius: 10, padding: "16px 20px", borderLeft: `3px solid ${color}` }}>
    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 22, fontFamily: "var(--font-head)", fontWeight: 700, color }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
  </div>
);

const SectionHead = ({ icon, title, color = "var(--accent)" }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
    <span style={{ color, display: "flex", alignItems: "center" }}>{typeof icon === "function" ? icon(color) : icon}</span>
    <h2 style={{ fontFamily: "var(--font-head)", fontSize: 16, fontWeight: 700, color }}>{title}</h2>
  </div>
);

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div className="modal-overlay" style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "#00000099", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", overflowY: "auto",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 14, padding: 28, minWidth: 320, maxWidth: 480, width: "100%",
        position: "relative", margin: "auto",
      }}>
        <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 15 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 22, cursor: "pointer", padding: "2px 8px" }}>✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function RowTable({ cols, rows, onDelete, onEdit, onReorder, onToggleHide, hiddenIds = [], accent = "var(--accent)" }) {
  const [confirm, confirmDialog] = useConfirm();
  const drag = onReorder ? useDragSort(rows, onReorder) : null;

  return (
    <div style={{ overflowX: "auto" }}>
      {confirmDialog}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {onReorder && <th style={{ borderBottom: "1px solid var(--border)", width: 20 }} />}
            {cols.map(c => (
              <th key={c.key} style={{
                textAlign: c.right ? "right" : "left", padding: "8px 12px",
                color: "var(--muted)", fontWeight: 500, fontSize: 11,
                textTransform: "uppercase", letterSpacing: 0.5,
                borderBottom: "1px solid var(--border)"
              }}>{c.label}</th>
            ))}
            {(onDelete || onEdit) && <th style={{ borderBottom: "1px solid var(--border)" }} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isHidden = hiddenIds.includes(row.id ?? i);
            return (
            <tr key={row.id ?? i}
              draggable={!!onReorder}
              onDragStart={() => drag?.onDragStart(i)}
              onDragOver={(e) => drag?.onDragOver(e, i)}
              onDragEnd={drag?.onDragEnd}
              style={{ background: i % 2 === 0 ? "transparent" : "#ffffff04", cursor: onReorder ? "grab" : "default", opacity: isHidden ? 0.45 : 1, transition: "opacity .2s" }}
              onMouseOver={e => e.currentTarget.style.background = accent + "0a"}
              onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "#ffffff04"}
            >
              {onReorder && (
                <td style={{ padding: "9px 6px", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 14, textAlign: "center", cursor: "grab" }}>⠿</td>
              )}
              {cols.map(c => (
                <td key={c.key} style={{
                  padding: "9px 12px", borderBottom: "1px solid var(--border)",
                  textAlign: c.right ? "right" : "left",
                  color: isHidden ? "var(--muted)" : (c.color ? c.color(row) : "var(--text)"),
                  textDecoration: isHidden ? "line-through" : "none",
                }}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
              {(onDelete || onEdit || onToggleHide) && (
                <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    {onToggleHide && (
                      <button
                        onClick={() => onToggleHide(row.id ?? i)}
                        title={isHidden ? "Mostrar — voltar ao total" : "Ocultar do total da fatura"}
                        style={{
                          background: isHidden ? "#ff6b6b22" : "var(--muted)11",
                          border: `1px solid ${isHidden ? "#ff6b6b44" : "var(--muted)33"}`,
                          borderRadius: 6, padding: "4px 8px", display: "flex", alignItems: "center",
                          cursor: "pointer",
                        }}
                        onMouseOver={e => e.currentTarget.style.background = isHidden ? "#ff6b6b33" : "var(--muted)22"}
                        onMouseOut={e => e.currentTarget.style.background = isHidden ? "#ff6b6b22" : "var(--muted)11"}
                      >
                        {isHidden ? Icons.eyeOff() : Icons.eyeOn()}
                      </button>
                    )}
                    {onEdit && (
                      <button onClick={() => onEdit(row)} style={{
                        background: "var(--accent4)11", border: "1px solid var(--accent4)33",
                        borderRadius: 6, padding: "4px 8px", display: "flex", alignItems: "center",
                        cursor: "pointer",
                      }}
                        onMouseOver={e => e.currentTarget.style.background = "var(--accent4)22"}
                        onMouseOut={e => e.currentTarget.style.background = "var(--accent4)11"}
                      >{Icons.edit()}</button>
                    )}
                    {onDelete && (
                      <button onClick={() => confirm({
                        title: "Excluir item",
                        message: `Tem certeza que deseja excluir "${row.desc || row.conta || row.nome || "este item"}"?`,
                        onConfirm: () => onDelete(row.id),
                      })} style={{
                        background: "#ff6b6b11", border: "1px solid #ff6b6b33", color: "#ff6b6b",
                        borderRadius: 6, padding: "4px 8px", display: "flex", alignItems: "center", gap: 4,
                        cursor: "pointer",
                      }}
                        onMouseOver={e => e.currentTarget.style.background = "#ff6b6b22"}
                        onMouseOut={e => e.currentTarget.style.background = "#ff6b6b11"}
                      >{Icons.trash()}</button>
                    )}
                  </div>
                </td>
              )}
            </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length + (onReorder ? 2 : 1)} style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Nenhum item cadastrado</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── TAB: Dashboard ───────────────────────────────────────────────────────────
function Dashboard({ data }) {
  const totalSaldo = sum(data.saldos, "saldo");
  const totalContasFixas = sum(data.contaFixa);
  const totalGastoVar = sum(data.gastoVar);
  const totalDevedores = sum(data.devedores.filter(d => d.status !== "PAGO"));
  const faturas = data.faturas || { bancos: [], itens: {} };
  const totalFatura = (faturas.bancos || []).reduce((acc, b) =>
    acc + sum((faturas.itens?.[b.id] || []).filter(i => i.mes === "FEV/26")), 0);
  const totalParcelasFixo = sum(data.gastoFixo);

  const devedoresByName = data.devedores
    .filter(d => d.status !== "PAGO")
    .reduce((acc, d) => {
      acc[d.nome] = (acc[d.nome] || 0) + d.valor;
      return acc;
    }, {});

  const colors = ["var(--accent)", "var(--accent4)", "var(--accent3)", "var(--accent2)"];

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatBox label="Total em Saldos" value={brl(totalSaldo)} color="var(--accent)" />
        <StatBox label="Contas Fixas/mês" value={brl(totalContasFixas)} color="var(--accent4)" />
        <StatBox label="Gastos Variáveis" value={brl(totalGastoVar)} color="var(--accent3)" />
        <StatBox label="A Receber" value={brl(totalDevedores)} color="var(--accent2)" />
        <StatBox label="Total Faturas (Fev)" value={brl(totalFatura)} color="#c084fc" />
        <StatBox label="Parcelas Fixas" value={brl(totalParcelasFixo)} color="#34d399" />
      </div>

      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <SectionHead icon={Icons.saldos} title="Saldos por Conta" color="var(--accent)" />
          {data.saldos.map((s, i) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--text)" }}>{s.conta}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: s.saldo > 0 ? "var(--accent)" : "var(--muted)" }}>{brl(s.saldo)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 8 }}>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>TOTAL</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{brl(totalSaldo)}</span>
          </div>
        </Card>

        <Card>
          <SectionHead icon={Icons.devedores} title="Devedores" color="var(--accent2)" />
          {Object.entries(devedoresByName).map(([nome, val], i) => (
            <div key={nome} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[i % colors.length] }} />
                <span style={{ fontSize: 13 }}>{nome}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent2)" }}>{brl(val)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 8 }}>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>TOTAL A RECEBER</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent2)" }}>{brl(totalDevedores)}</span>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHead icon={Icons.chart} title="Visão Geral de Gastos" color="var(--accent3)" />
        {[
          { label: "Contas Fixas Mensais", val: totalContasFixas, color: "var(--accent4)", max: 1200 },
          { label: "Parcelas Cartão (fixo)", val: totalParcelasFixo, color: "#34d399", max: 800 },
          { label: "Gastos Variáveis", val: totalGastoVar, color: "var(--accent3)", max: 600 },
          { label: "Total Faturas (Fev)", val: totalFatura, color: "#c084fc", max: 4000 },
        ].map(({ label, val, color, max }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color }}>{brl(val)}</span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3 }}>
              <div style={{ height: "100%", width: `${Math.min(100, (val / max) * 100)}%`, background: color, borderRadius: 3, transition: "width .6s ease" }} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── TAB: Gastos ──────────────────────────────────────────────────────────────
function Gastos({ data, setData }) {
  const [modal, setModal] = useState(null); // section name or "edit"
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [confirm, confirmDialog] = useConfirm();
  const [hiddenIds, setHiddenIds] = useState({});

  const toggleHide = (section, id) => {
    setHiddenIds(prev => {
      const key = section + ":" + id;
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = true;
      return next;
    });
  };
  const getHiddenFor = (section) => Object.keys(hiddenIds)
    .filter(k => k.startsWith(section + ":"))
    .map(k => parseInt(k.split(":")[1]));

  const openAdd = (section) => { setForm({}); setEditItem(null); setModal(section); };
  const openEdit = (section, row) => { setForm({ ...row, valor: String(row.valor) }); setEditItem({ section, id: row.id }); setModal("edit"); };

  const handleAdd = () => {
    if (modal === "edit" && editItem) {
      const updated = { ...data, [editItem.section]: data[editItem.section].map(x => x.id === editItem.id ? { ...x, ...form, valor: parseFloat(form.valor) || 0 } : x) };
      setData(updated);
      setModal(null); return;
    }
    if (modal === "gastoFixo") {
      if (!form.desc || !form.valor) return;
      setData({ ...data, gastoFixo: [...data.gastoFixo, { id: nextId(data.gastoFixo), desc: form.desc, situacao: form.situacao || "FIXO", parcela: form.parcela || "—", valor: parseFloat(form.valor) }] });
    } else if (modal === "contaFixa") {
      if (!form.desc || !form.valor) return;
      setData({ ...data, contaFixa: [...data.contaFixa, { id: nextId(data.contaFixa), desc: form.desc, venc: form.venc || "—", valor: parseFloat(form.valor) }] });
    } else if (modal === "gastoVar") {
      if (!form.desc || !form.valor) return;
      setData({ ...data, gastoVar: [...data.gastoVar, { id: nextId(data.gastoVar), desc: form.desc, data: form.data || "—", valor: parseFloat(form.valor), quem: form.quem || "PRÓPRIO" }] });
    }
    setModal(null);
  };

  const del = (section, id) => {
    const item = data[section].find(x => x.id === id);
    confirm({
      title: "Excluir item",
      message: `Deseja excluir "${item?.desc || "este item"}"?`,
      onConfirm: () => setData({ ...data, [section]: data[section].filter(x => x.id !== id) }),
    });
  };

  const reorder = (section, newArr) => setData({ ...data, [section]: newArr });

  const getModalTitle = () => {
    if (modal === "edit") return "Editar Item";
    if (modal === "gastoFixo") return "Nova Parcela Fixa";
    if (modal === "contaFixa") return "Nova Conta Fixa";
    return "Novo Gasto Variável";
  };

  const section = modal === "edit" ? editItem?.section : modal;

  const inp = (label, key, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      {(key === "data") && type === "text"
        ? <input type="text" placeholder={placeholder || "DD/MM/AA"} value={form[key] || ""}
            onChange={e => setForm(f => ({ ...f, [key]: maskDate(e.target.value) }))}
            style={{ width: "100%" }} />
        : <input type={type} placeholder={placeholder} value={form[key] || ""}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            style={{ width: "100%" }} />
      }
    </div>
  );

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {confirmDialog}
      {modal && (
        <Modal title={getModalTitle()} onClose={() => setModal(null)}>
          {(section === "gastoFixo") && <>{inp("Descrição", "desc")} {inp("Situação", "situacao", "text", "FIXO")} {inp("Parcela", "parcela", "text", "1/10")} {inp("Valor (R$)", "valor", "number", "0.00")}</>}
          {(section === "contaFixa") && <>{inp("Descrição", "desc")} {inp("Vencimento", "venc", "text", "DIA 15")} {inp("Valor (R$)", "valor", "number", "0.00")}</>}
          {(section === "gastoVar")  && <>{inp("Descrição", "desc")} {inp("Data", "data", "text", "DD/MM/AA")} {inp("Valor (R$)", "valor", "number", "0.00")} {inp("Quem Paga", "quem", "text", "PRÓPRIO")}</>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <Btn onClick={handleAdd} style={{ flex: 1 }}>{modal === "edit" ? "Salvar" : "+ Adicionar"}</Btn>
            <Btn onClick={() => setModal(null)} color="var(--muted)">Cancelar</Btn>
          </div>
        </Modal>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <SectionHead icon={Icons.faturas} title="Parcelas Fixas no Cartão" color="var(--accent4)" />
          <Btn small onClick={() => openAdd("gastoFixo")} color="var(--accent4)">+ Adicionar</Btn>
        </div>
        <RowTable
          accent="var(--accent4)"
          cols={[
            { key: "desc", label: "Descrição" },
            { key: "situacao", label: "Situação", render: r => <Tag color="var(--accent4)">{r.situacao}</Tag> },
            { key: "parcela", label: "Parcela" },
            { key: "valor", label: "Valor", right: true, render: r => brl(r.valor) },
          ]}
          rows={data.gastoFixo}
          onDelete={id => del("gastoFixo", id)}
          onEdit={row => openEdit("gastoFixo", row)}
          onReorder={newArr => reorder("gastoFixo", newArr)}
          onToggleHide={id => toggleHide("gastoFixo", id)}
          hiddenIds={getHiddenFor("gastoFixo")}
        />
        <div style={{ textAlign: "right", marginTop: 10, fontSize: 13, color: "var(--accent4)", fontWeight: 600 }}>
          Total: {brl(sum(data.gastoFixo.filter(r => !getHiddenFor("gastoFixo").includes(r.id))))}
          {getHiddenFor("gastoFixo").length > 0 && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>({getHiddenFor("gastoFixo").length} oculto{getHiddenFor("gastoFixo").length > 1 ? "s" : ""})</span>}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <SectionHead icon={Icons.receipt} title="Contas Fixas Mensais" color="var(--accent)" />
          <Btn small onClick={() => openAdd("contaFixa")}>+ Adicionar</Btn>
        </div>
        <RowTable
          cols={[
            { key: "desc", label: "Descrição" },
            { key: "venc", label: "Vencimento" },
            { key: "valor", label: "Valor", right: true, render: r => brl(r.valor) },
          ]}
          rows={data.contaFixa}
          onDelete={id => del("contaFixa", id)}
          onEdit={row => openEdit("contaFixa", row)}
          onReorder={newArr => reorder("contaFixa", newArr)}
          onToggleHide={id => toggleHide("contaFixa", id)}
          hiddenIds={getHiddenFor("contaFixa")}
        />
        <div style={{ textAlign: "right", marginTop: 10, fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
          Total: {brl(sum(data.contaFixa.filter(r => !getHiddenFor("contaFixa").includes(r.id))))}
          {getHiddenFor("contaFixa").length > 0 && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>({getHiddenFor("contaFixa").length} oculto{getHiddenFor("contaFixa").length > 1 ? "s" : ""})</span>}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <SectionHead icon={Icons.gastos} title="Gastos Variáveis" color="var(--accent3)" />
          <Btn small onClick={() => openAdd("gastoVar")} color="var(--accent3)">+ Adicionar</Btn>
        </div>
        <RowTable
          accent="var(--accent3)"
          cols={[
            { key: "desc", label: "Descrição" },
            { key: "data", label: "Data" },
            { key: "quem", label: "Quem Paga", render: r => <Tag color={r.quem === "PRÓPRIO" ? "var(--muted)" : "var(--accent3)"}>{r.quem}</Tag> },
            { key: "valor", label: "Valor", right: true, render: r => brl(r.valor) },
          ]}
          rows={data.gastoVar}
          onDelete={id => del("gastoVar", id)}
          onEdit={row => openEdit("gastoVar", row)}
          onReorder={newArr => reorder("gastoVar", newArr)}
          onToggleHide={id => toggleHide("gastoVar", id)}
          hiddenIds={getHiddenFor("gastoVar")}
        />
        <div style={{ textAlign: "right", marginTop: 10, fontSize: 13, color: "var(--accent3)", fontWeight: 600 }}>
          Total: {brl(sum(data.gastoVar.filter(r => !getHiddenFor("gastoVar").includes(r.id))))}
          {getHiddenFor("gastoVar").length > 0 && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>({getHiddenFor("gastoVar").length} oculto{getHiddenFor("gastoVar").length > 1 ? "s" : ""})</span>}
        </div>
      </Card>
    </div>
  );
}

// ─── TAB: Saldos ─────────────────────────────────────────────────────────────
function Saldos({ data, setData }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [editId, setEditId] = useState(null);
  const [confirm, confirmDialog] = useConfirm();

  const openAdd = () => { setForm({}); setEditId(null); setModal(true); };
  const openEdit = (s) => { setForm({ conta: s.conta, saldo: s.saldo, obs: s.obs }); setEditId(s.id); setModal(true); };

  const handleSave = () => {
    if (!form.conta) return;
    if (editId) {
      setData({ ...data, saldos: data.saldos.map(s => s.id === editId ? { ...s, ...form, saldo: parseFloat(form.saldo) || 0 } : s) });
    } else {
      setData({ ...data, saldos: [...data.saldos, { id: nextId(data.saldos), conta: form.conta, saldo: parseFloat(form.saldo) || 0, obs: form.obs || "" }] });
    }
    setModal(false);
  };

  const del = (s) => confirm({
    title: "Excluir conta",
    message: `Deseja excluir a conta "${s.conta}"? Esta ação não pode ser desfeita.`,
    onConfirm: () => setData({ ...data, saldos: data.saldos.filter(x => x.id !== s.id) }),
  });

  const total = sum(data.saldos, "saldo");
  const inp = (label, key, type = "text") => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      <input type={type} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: "100%" }} />
    </div>
  );

  return (
    <div className="fade-in">
      {confirmDialog}
      {modal && (
        <Modal title={editId ? "Editar Conta" : "Nova Conta"} onClose={() => setModal(false)}>
          {inp("Nome da Conta", "conta")}
          {inp("Saldo (R$)", "saldo", "number")}
          {inp("Observação", "obs")}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={handleSave} style={{ flex: 1 }}>Salvar</Btn>
            <Btn onClick={() => setModal(false)} color="var(--muted)">Cancelar</Btn>
          </div>
        </Modal>
      )}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <SectionHead icon={Icons.saldos} title="Saldos e Reservas" color="var(--accent)" />
          <Btn small onClick={openAdd}>+ Nova Conta</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
          {data.saldos.map(s => (
            <div key={s.id} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, position: "relative", borderLeft: `3px solid ${s.saldo > 1000 ? "var(--accent)" : s.saldo > 0 ? "var(--accent3)" : "var(--muted)"}` }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{s.conta}</div>
              <div style={{ fontSize: 22, fontFamily: "var(--font-head)", fontWeight: 700, color: s.saldo > 0 ? "var(--accent)" : "var(--muted)" }}>{brl(s.saldo)}</div>
              {s.obs && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{s.obs}</div>}
              <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }}>
                <button onClick={() => openEdit(s)} style={{ background: "var(--accent4)11", border: "1px solid var(--accent4)33", borderRadius: 6, padding: "3px 7px", display: "flex", alignItems: "center", cursor: "pointer" }}>{Icons.edit()}</button>
                <button onClick={() => del(s)} style={{ background: "#ff6b6b11", border: "1px solid #ff6b6b33", borderRadius: 6, padding: "3px 7px", display: "flex", alignItems: "center", cursor: "pointer" }}>{Icons.trash()}</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, textAlign: "right" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>TOTAL GERAL: </span>
          <span style={{ fontSize: 20, fontFamily: "var(--font-head)", fontWeight: 700, color: "var(--accent)", marginLeft: 8 }}>{brl(total)}</span>
        </div>
      </Card>
    </div>
  );
}

// ─── TAB: Devedores ───────────────────────────────────────────────────────────
function Devedores({ data, setData }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [editObs, setEditObs] = useState(null); // id do item sendo editado
  const [obsText, setObsText] = useState("");
  const [confirm, confirmDialog] = useConfirm();

  const handleAdd = () => {
    if (!form.nome || !form.desc || !form.valor) return;
    const novo = { id: nextId(data.devedores), nome: form.nome.toUpperCase(), desc: form.desc, valor: parseFloat(form.valor), prazo: form.prazo || "—", status: "PENDENTE", obs: form.obs || "" };
    setData({ ...data, devedores: [...data.devedores, novo] });
    setModal(false);
  };

  const toggleStatus = (id) => {
    setData({ ...data, devedores: data.devedores.map(d => d.id === id ? { ...d, status: d.status === "PAGO" ? "PENDENTE" : "PAGO" } : d) });
  };

  const saveObs = (id) => {
    setData({ ...data, devedores: data.devedores.map(d => d.id === id ? { ...d, obs: obsText } : d) });
    setEditObs(null);
    setObsText("");
  };

  const del = (row) => confirm({
    title: "Excluir devedor",
    message: `Deseja excluir "${row.desc}" de ${row.nome}?`,
    onConfirm: () => setData({ ...data, devedores: data.devedores.filter(d => d.id !== row.id) }),
  });

  const byName = data.devedores.reduce((acc, d) => {
    if (!acc[d.nome]) acc[d.nome] = [];
    acc[d.nome].push(d);
    return acc;
  }, {});

  const inp = (label, key, type = "text", ph = "") => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      <input type={type} placeholder={ph} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: "100%" }} />
    </div>
  );

  const nameColors = ["var(--accent)", "var(--accent4)", "var(--accent3)", "var(--accent2)", "#c084fc", "#22d3ee", "#f472b6"];

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {confirmDialog}

      {/* Modal novo devedor */}
      {modal && (
        <Modal title="Novo Devedor" onClose={() => setModal(false)}>
          {inp("Nome", "nome", "text", "Ex: FULANO")}
          {inp("Descrição", "desc", "text", "Ex: Empréstimo")}
          {inp("Valor (R$)", "valor", "number", "0.00")}
          {inp("Prazo", "prazo", "text", "DD/MM")}
          {inp("Observação", "obs", "text", "Ex: Combinado pagar na sexta...")}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={handleAdd} style={{ flex: 1 }}>+ Adicionar</Btn>
            <Btn onClick={() => setModal(false)} color="var(--muted)">Cancelar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal editar observação */}
      {editObs !== null && (
        <Modal title="Editar Observação" onClose={() => { setEditObs(null); setObsText(""); }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Observação</label>
            <textarea
              value={obsText}
              onChange={e => setObsText(e.target.value)}
              placeholder="Ex: Combinado pagar na sexta, vai parcelar em 2x..."
              rows={3}
              style={{ width: "100%", resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 14 }}
              autoFocus
            />
          </div>
          {obsText && (
            <div style={{ marginBottom: 14, padding: "8px 12px", background: "var(--accent)11", border: "1px solid var(--accent)33", borderRadius: 8, fontSize: 12, color: "var(--accent)" }}>
              💬 {obsText}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => saveObs(editObs)} style={{ flex: 1 }}>Salvar</Btn>
            {obsText !== "" && (
              <Btn onClick={() => { setObsText(""); saveObs(editObs); }} color="var(--muted)">Limpar</Btn>
            )}
            <Btn onClick={() => { setEditObs(null); setObsText(""); }} color="var(--muted)">Cancelar</Btn>
          </div>
        </Modal>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn onClick={() => { setForm({}); setModal(true); }} color="var(--accent2)">+ Novo Devedor</Btn>
      </div>

      {Object.entries(byName).map(([nome, items], groupIdx) => {
        const color = nameColors[groupIdx % nameColors.length];
        const totalPend = sum(items.filter(i => i.status !== "PAGO"));
        const totalPago = sum(items.filter(i => i.status === "PAGO"));
        return (
          <Card key={nome}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: color + "22", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-head)", fontWeight: 700, color, fontSize: 13 }}>
                  {nome.substring(0, 2)}
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 14, color }}>{nome}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{items.length} item(s)</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Pendente</div>
                <div style={{ fontSize: 16, fontWeight: 700, color }}>{brl(totalPend)}</div>
              </div>
            </div>

            {/* Itens */}
            {items.map((r, i) => (
              <div key={r.id} style={{
                padding: "10px 12px", borderBottom: "1px solid var(--border)",
                background: i % 2 === 0 ? "transparent" : "#ffffff04",
                borderRadius: i === 0 ? "8px 8px 0 0" : i === items.length - 1 ? "0 0 8px 8px" : 0,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  {/* Desc + obs */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: r.status === "PAGO" ? "var(--muted)" : "var(--text)", textDecoration: r.status === "PAGO" ? "line-through" : "none" }}>
                      {r.desc}
                    </div>
                    {r.obs ? (
                      <div
                        onClick={() => { setEditObs(r.id); setObsText(r.obs || ""); }}
                        style={{ fontSize: 11, color: "var(--accent4)", marginTop: 3, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        💬 {r.obs}
                        <span style={{ fontSize: 10, color: "var(--muted)", opacity: 0.7 }}>✎</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditObs(r.id); setObsText(""); }}
                        style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                      >
                        + obs
                      </button>
                    )}
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>📅 {r.prazo}</div>
                  </div>

                  {/* Valor + ações */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: r.status === "PAGO" ? "var(--muted)" : color, textDecoration: r.status === "PAGO" ? "line-through" : "none" }}>
                      {brl(r.valor)}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => toggleStatus(r.id)}
                        style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer", border: `1px solid ${r.status === "PAGO" ? "var(--accent)" : "var(--accent2)"}44`, background: r.status === "PAGO" ? "#4fffb022" : "#ff6b6b22", color: r.status === "PAGO" ? "var(--accent)" : "var(--accent2)" }}
                      >
                        {r.status === "PAGO" ? "✓ PAGO" : "⏳ PEND"}
                      </button>
                      <button
                        onClick={() => del(r)}
                        style={{ background: "#ff6b6b11", border: "1px solid #ff6b6b33", borderRadius: 4, padding: "2px 6px", display: "flex", alignItems: "center", cursor: "pointer" }}
                      >
                        {Icons.trash()}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {totalPago > 0 && (
              <div style={{ textAlign: "right", marginTop: 8, fontSize: 12, color: "var(--accent)" }}>✓ {brl(totalPago)} já recebido</div>
            )}
          </Card>
        );
      })}

      <Card style={{ background: "var(--surface2)", border: "1px solid var(--accent2)33" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 14 }}>TOTAL A RECEBER</span>
          <span style={{ fontSize: 20, fontFamily: "var(--font-head)", fontWeight: 700, color: "var(--accent2)" }}>
            {brl(sum(data.devedores.filter(d => d.status !== "PAGO")))}
          </span>
        </div>
      </Card>
    </div>
  );
}

// ─── TAB: Faturas (dinâmico) ─────────────────────────────────────────────────
const CORES_PRESET = [
  { label: "Roxo",    hex: "#c084fc" },
  { label: "Laranja", hex: "#f97316" },
  { label: "Verde",   hex: "#4fffb0" },
  { label: "Azul",    hex: "#74b9ff" },
  { label: "Rosa",    hex: "#f472b6" },
  { label: "Amarelo", hex: "#ffd166" },
  { label: "Vermelho",hex: "#ff6b6b" },
  { label: "Ciano",   hex: "#22d3ee" },
];

const MESES = ["JAN/26", "FEV/26", "MAR/26", "ABR/26", "MAI/26", "JUN/26", "JUL/26", "AGO/26", "SET/26", "OUT/26"];

const isLastParcela = (desc) => {
  const m = desc.match(/\((\d+)\/(\d+)\)/);
  return m ? parseInt(m[1]) === parseInt(m[2]) : false;
};

function FaturasBanco({ cfg, items, allItems, onAdd, onDelete, onEdit, onReorder, mes, fechada, onToggleHide, hiddenIds = [] }) {
  const fixosGlobais = allItems.filter(i => i.tipo === "FIXO");
  const mesItems = items.filter(i => i.mes === mes);
  const fixos = [
    ...fixosGlobais,
    ...mesItems.filter(i => i.tipo === "PARCELA"),
  ].filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx);
  const vars = mesItems.filter(f => f.tipo === "VARIÁVEL");
  const tipoColor = { PARCELA: "var(--accent4)", FIXO: "var(--accent)", VARIÁVEL: "var(--accent3)" };
  const visibleFixos = fixos.filter(r => !hiddenIds.includes(r.id));
  const visibleVars = vars.filter(r => !hiddenIds.includes(r.id));
  const total = sum([...visibleFixos, ...visibleVars]);
  const colorBorder = cfg.cor + "44";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: cfg.cor + "18", border: `1px solid ${colorBorder}`, borderRadius: 14, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: cfg.cor + "22", border: `2px solid ${colorBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: cfg.cor }} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 18, color: cfg.cor }}>{cfg.nome}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              Vencimento: {cfg.vencimento} &nbsp;·&nbsp; Limite: {cfg.limite ? `R$ ${cfg.limite}` : "—"}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {fechada && <div style={{ fontSize: 10, background: "var(--accent)22", color: "var(--accent)", border: "1px solid var(--accent)44", borderRadius: 4, padding: "2px 8px", marginBottom: 6, display: "inline-block" }}>✅ FECHADA</div>}
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Total {mes}</div>
          <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 26, color: cfg.cor }}>{brl(total)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        <StatBox label="Parcelas + Fixos" value={brl(sum(visibleFixos))} color="var(--accent4)" />
        <StatBox label="Variáveis" value={brl(sum(visibleVars))} color="var(--accent3)" />
        <StatBox label="Lançamentos" value={fixos.length + vars.length} color={cfg.cor} />
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <SectionHead icon={Icons.faturas} title="Parcelas e Lançamentos Fixos" color="var(--accent4)" />
          <Btn small onClick={() => onAdd("FIXO")} color="var(--accent4)">+ Fixo/Parcela</Btn>
        </div>
        <RowTable
          accent="var(--accent4)"
          cols={[
            { key: "desc", label: "Descrição", render: r => (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {r.desc}
                {r.tipo === "FIXO" && <span style={{ fontSize: 10, background: "var(--accent)22", color: "var(--accent)", border: "1px solid var(--accent)44", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>TODOS OS MESES</span>}
                {r.tipo === "PARCELA" && isLastParcela(r.desc) && (
                  <span style={{ fontSize: 10, background: "#ff6b6b22", color: "#ff6b6b", border: "1px solid #ff6b6b44", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>ÚLTIMA ✓</span>
                )}
              </span>
            )},
            { key: "tipo", label: "Tipo", render: r => <Tag color={tipoColor[r.tipo] || "var(--muted)"}>{r.tipo}</Tag> },
            { key: "data", label: "Data/Ref" },
            { key: "valor", label: "Valor", right: true, render: r => brl(r.valor) },
          ]}
          rows={fixos}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggleHide={onToggleHide}
          hiddenIds={hiddenIds}
        />
        {fixos.length > 0 && <div style={{ textAlign: "right", marginTop: 8, fontSize: 13, fontWeight: 600, color: "var(--accent4)" }}>
          Subtotal: {brl(sum(visibleFixos))}
          {(fixos.length - visibleFixos.length) > 0 && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>({fixos.length - visibleFixos.length} oculto{fixos.length - visibleFixos.length > 1 ? "s" : ""})</span>}
        </div>}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <SectionHead icon={Icons.gastos} title="Lançamentos Variáveis" color="var(--accent3)" />
          <Btn small onClick={() => onAdd("VARIÁVEL")} color="var(--accent3)">+ Variável</Btn>
        </div>
        <RowTable
          accent="var(--accent3)"
          cols={[
            { key: "desc", label: "Descrição" },
            { key: "data", label: "Data" },
            { key: "valor", label: "Valor", right: true, render: r => brl(r.valor) },
          ]}
          rows={vars}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggleHide={onToggleHide}
          hiddenIds={hiddenIds}
          onReorder={newVars => {
            // Rebuild full itemsBanco: keep all non-var items, replace vars with reordered ones
            const nonVars = items.filter(i => !(i.mes === mes && i.tipo === "VARIÁVEL"));
            onReorder([...nonVars, ...newVars]);
          }}
        />
        {vars.length > 0 && <div style={{ textAlign: "right", marginTop: 8, fontSize: 13, fontWeight: 600, color: "var(--accent3)" }}>
          Subtotal: {brl(sum(visibleVars))}
          {(vars.length - visibleVars.length) > 0 && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>({vars.length - visibleVars.length} oculto{vars.length - visibleVars.length > 1 ? "s" : ""})</span>}
        </div>}
      </Card>

      <div style={{ background: cfg.cor + "18", border: `1px solid ${colorBorder}`, borderRadius: 12, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 14, color: cfg.cor }}>TOTAL {cfg.nome.toUpperCase()} – {mes}</span>
        <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 22, color: cfg.cor }}>{brl(total)}{hiddenIds.length > 0 && <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8, fontWeight: 400, fontFamily: "var(--font-mono)" }}>({hiddenIds.length} oculto{hiddenIds.length > 1 ? "s" : ""})</span>}</span>
      </div>
    </div>
  );
}

function Faturas({ data, setData }) {
  const [bancoSel, setBancoSel] = useState(null);
  const [mesManual, setMesManual] = useState({}); // { bancoId: "MES" } — só quando usuário troca manualmente
  const now = useClock();
  const nowBrasilia = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const horaStr = nowBrasilia.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dataStr = nowBrasilia.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

  // Mês padrão = mês real de Brasília
  const mesAtual = getMesAtual();

  // Para cada banco: usa manual se definido, senão usa o primeiro mês aberto ≥ mês atual
  const getMesBanco = (bancoId) => {
    if (mesManual[bancoId]) return mesManual[bancoId];
    const fechadasObj = data?.faturas?.fechadas ?? {};
    // Começa do mês atual, pega o primeiro não fechado
    const idxAtual = MESES.indexOf(mesAtual);
    const candidatos = idxAtual >= 0 ? MESES.slice(idxAtual) : MESES;
    return candidatos.find(m => !fechadasObj[`${bancoId}:${m}`]) || mesAtual;
  };

  const mes = bancoSel ? getMesBanco(bancoSel) : mesAtual;
  const setMes = (m) => bancoSel && setMesManual(prev => ({ ...prev, [bancoSel]: m }));
  const [modal, setModal] = useState(null);
  const [modalBanco, setModalBanco] = useState(false);
  const [editBanco, setEditBanco] = useState(null);
  const [form, setForm] = useState({});
  const [formBanco, setFormBanco] = useState({ nome: "", cor: "#c084fc", vencimento: "", limite: "" });
  const [confirm, confirmDialog] = useConfirm();
  const [modalHistorico, setModalHistorico] = useState(false);
  const [hiddenFaturaIds, setHiddenFaturaIds] = useState({});

  const toggleHideFatura = (bancoId, itemId) => {
    setHiddenFaturaIds(prev => {
      const key = bancoId + ":" + itemId;
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = true;
      return next;
    });
  };
  const getHiddenFaturaIds = (bancoId) => Object.keys(hiddenFaturaIds)
    .filter(k => k.startsWith(bancoId + ":"))
    .map(k => parseInt(k.split(":")[1]));

  const faturas = data.faturas || { bancos: [], itens: {}, fechadas: {} };
  const bancos = faturas.bancos || [];
  const itens = faturas.itens || {};
  const fechadas = faturas.fechadas ?? {};  // ?? garante mesmo que seja null/undefined

  const bancoAtual = bancos.find(b => b.id === bancoSel) || null;
  const itemsBanco = itens[bancoSel] || [];
  const isParcela = modal === "FIXO" && form.tipo === "PARCELA";

  // Chave única desta fatura (banco + mês)
  const faturaKey = bancoSel ? `${bancoSel}:${mes}` : null;
  const faturaFechada = faturaKey ? !!fechadas[faturaKey] : false;

  // ── Fechar fatura atual e propagar devedores pro próximo mês ──────
  const handleFecharFatura = () => {
    if (!bancoSel || !bancoAtual) return;
    const mesAtualIdx = MESES.indexOf(mes);
    const proximoMes = MESES[mesAtualIdx + 1] || null;

    confirm({
      title: `Fechar fatura ${bancoAtual.nome} – ${mes}`,
      message: proximoMes
        ? `A fatura de ${mes} será fechada. O próximo mês (${proximoMes}) será aberto com os lançamentos FIXOS. Devedores com 'NOME só serão propagados se o lançamento for FIXO. Continuar?`
        : `A fatura de ${mes} será marcada como fechada. É o último mês disponível.`,
      onConfirm: () => {
        // ── 1. Marcar mês atual como fechado ──────────────────────────
        const novasFechadas = { ...fechadas, [faturaKey]: true };

        // ── 2. Montar todos os itens visíveis neste mês ───────────────
        const fixosGlobais = itemsBanco.filter(i => i.tipo === "FIXO");
        const mesItens = itemsBanco.filter(i => i.mes === mes);
        const todosItens = [...fixosGlobais, ...mesItens]
          .filter((x, idx, arr) => arr.findIndex(y => y.id === x.id) === idx);

        // ── 3. Limpar devedores PENDENTES desta fatura ────────────────
        // Remove pelo faturaItemId (preciso) ou pelo nome+desc+valor (fallback para antigos)
        let novosDevedores = [...data.devedores];
        todosItens.forEach(item => {
          novosDevedores = novosDevedores.filter(d => {
            if (d.faturaItemId === item.id && d.faturabancoId === bancoSel && d.status === "PENDENTE") return false;
            return true;
          });
        });

        // ── 4. Propagar devedores 'NOME APENAS se o lançamento for FIXO
        if (proximoMes) {
          todosItens
            .filter(item => item.tipo === "FIXO")
            .forEach(item => {
              const info = extractDevedor(item.desc);
              if (!info) return;
              novosDevedores.push({
                id: nextId(novosDevedores),
                nome: info.nome,
                desc: info.descLimpa || item.desc,
                valor: item.valor,
                prazo: bancoAtual.vencimento || "—",
                status: "PENDENTE",
                obs: `Fatura ${bancoAtual.nome} ${proximoMes}`,
                faturaItemId: item.id,
                faturabancoId: bancoSel,
              });
            });
        }

        // ── 5. Navegar automaticamente pro próximo mês após fechar ─────
        // Os lançamentos FIXO (mes:"FIXO") já aparecem em todos os meses automaticamente.
        // Parcelas e variáveis ficam apenas no mês específico. Nada a copiar.

        setData({
          ...data,
          devedores: novosDevedores,
          faturas: { ...faturas, fechadas: novasFechadas },
        });

        // Abrir próximo mês automaticamente
        if (proximoMes) setTimeout(() => setMes(proximoMes), 300);
      },
    });
  };

  const handleReabrirFatura = () => {
    if (!faturaKey) return;
    const novasFechadas = { ...fechadas };
    delete novasFechadas[faturaKey];
    setData({ ...data, faturas: { ...faturas, fechadas: novasFechadas } });
  };

  // ── Banco CRUD ──
  const handleSaveBanco = () => {
    if (!formBanco.nome || !formBanco.cor) return;
    let novos;
    if (editBanco) {
      novos = bancos.map(b => b.id === editBanco ? { ...b, ...formBanco } : b);
    } else {
      const id = Date.now().toString();
      novos = [...bancos, { id, ...formBanco }];
      setBancoSel(id);
    }
    setData({ ...data, faturas: { ...faturas, bancos: novos } });
    setModalBanco(false);
    setEditBanco(null);
    setFormBanco({ nome: "", cor: "#c084fc", vencimento: "", limite: "" });
  };

  const handleDeleteBanco = (id) => {
    const banco = bancos.find(b => b.id === id);
    confirm({
      title: `Excluir ${banco?.nome || "cartão"}`,
      message: `Isso vai excluir o cartão e TODOS os lançamentos vinculados a ele permanentemente.`,
      requireText: "CONFIRMAR",
      onConfirm: () => {
        const novos = bancos.filter(b => b.id !== id);
        const novosItens = { ...itens };
        delete novosItens[id];
        if (bancoSel === id) setBancoSel(novos[0]?.id || null);
        setData({ ...data, faturas: { ...faturas, bancos: novos, itens: novosItens } });
      },
    });
  };

  const openEditBanco = (b) => {
    setFormBanco({ nome: b.nome, cor: b.cor, vencimento: b.vencimento, limite: b.limite });
    setEditBanco(b.id);
    setModalBanco(true);
  };

  // ── Lançamento CRUD ──
  const [editItem, setEditItem] = useState(null);

  const handleAdd = () => {
    if (!form.desc || !form.valor || !bancoSel) return;
    const tipo = modal === "VARIÁVEL" ? "VARIÁVEL" : (form.tipo || "FIXO");
    const valor = parseFloat(form.valor) || 0;
    const dataRef = form.data || (modal === "VARIÁVEL" ? "—" : "FIXO");
    const totalParcelas = tipo === "PARCELA" ? (parseInt(form.totalParcelas) || 1) : 1;
    const parcelaInicial = tipo === "PARCELA" ? (parseInt(form.parcelaInicial) || 1) : 1;
    const mesInicio = MESES.indexOf(mes);
    const newEntries = [];
    let baseId = nextId([...itemsBanco, ...newEntries]);

    if (tipo === "PARCELA") {
      for (let p = parcelaInicial; p <= totalParcelas; p++) {
        const mesIdx = mesInicio + (p - parcelaInicial);
        if (mesIdx >= MESES.length) break;
        newEntries.push({ id: baseId++, mes: MESES[mesIdx], desc: `${form.desc} (${p}/${totalParcelas})`, tipo: "PARCELA", data: dataRef, valor });
      }
    } else {
      // FIXO: store without specific month so it shows everywhere
      newEntries.push({ id: baseId, mes: tipo === "FIXO" ? "FIXO" : mes, desc: form.desc, tipo, data: dataRef, valor });
    }

    // Apostrophe detection → auto-create devedor
    const devedorInfo = extractDevedor(form.desc);
    let newData = { ...data };
    if (devedorInfo) {
      const { nome: nomeDevedor, descLimpa } = devedorInfo;
      const itemId = newEntries[0]?.id ?? baseId;
      const novoDevedor = {
        id: nextId(newData.devedores),
        nome: nomeDevedor,
        desc: descLimpa || form.desc,
        valor,
        prazo: bancoAtual?.vencimento || "—",
        status: "PENDENTE",
        obs: "",
        faturaItemId: itemId,   // ← vínculo direto com o lançamento
        faturabancoId: bancoSel, // ← e com o banco
      };
      newData = { ...newData, devedores: [...newData.devedores, novoDevedor] };
    }

    const updatedItens = { ...itens, [bancoSel]: [...itemsBanco, ...newEntries] };
    setData({ ...newData, faturas: { ...faturas, itens: updatedItens } });
    setModal(null);
    setForm({});
  };

  const handleEditItem = (row) => {
    setEditItem(row);
    setForm({ desc: row.desc, valor: String(row.valor), data: row.data, tipo: row.tipo });
    setModal("edit");
  };

  const handleSaveEdit = () => {
    if (!editItem) return;
    // Search the full itemsBanco array (includes FIXO with mes:"FIXO")
    const updatedItens = {
      ...itens,
      [bancoSel]: itemsBanco.map(i => i.id === editItem.id
        ? { ...i, desc: form.desc, valor: parseFloat(form.valor) || i.valor, data: form.data || i.data }
        : i
      ),
    };
    setData({ ...data, faturas: { ...faturas, itens: updatedItens } });
    setModal(null);
    setEditItem(null);
    setForm({});
  };

  const handleReorderItems = (newDisplayArr) => {
    // newDisplayArr is the reordered display list (may contain FIXO + mes-specific items mixed)
    // We need to rebuild itemsBanco preserving ALL stored items, just reordered
    const reorderedIds = newDisplayArr.map(i => i.id);
    // Items NOT in the display (other months' non-FIXO items) stay untouched
    const notInDisplay = itemsBanco.filter(i => !reorderedIds.includes(i.id));
    setData({ ...data, faturas: { ...faturas, itens: { ...itens, [bancoSel]: [...newDisplayArr, ...notInDisplay] } } });
  };

  const handleDelete = (id) => {
    const item = itemsBanco.find(i => i.id === id);
    confirm({
      title: "Excluir lançamento",
      message: `Deseja excluir "${item?.desc || "este lançamento"}"?`,
      onConfirm: () => {
        const updatedItens = { ...itens, [bancoSel]: itemsBanco.filter(i => i.id !== id) };
        // Se tinha 'NOME → remove o devedor vinculado pelo faturaItemId (preciso)
        let updatedDevedores = data.devedores;
        if (item) {
          updatedDevedores = data.devedores.filter(d =>
            !(d.faturaItemId === item.id && d.faturabancoId === bancoSel && d.status === "PENDENTE")
          );
        }
        setData({ ...data, devedores: updatedDevedores, faturas: { ...faturas, itens: updatedItens } });
      },
    });
  };

  const totalGeral = bancos.reduce((acc, b) => {
    const bItens = itens[b.id] || [];
    const fixos = bItens.filter(i => i.tipo === "FIXO");
    const mesItens = bItens.filter(i => i.mes === mes && i.tipo !== "FIXO");
    return acc + sum([...fixos, ...mesItens]);
  }, 0);

  const inp = (label, key, type = "text", ph = "") => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      {key === "data" && type === "text"
        ? <input type="text" placeholder={ph || "DD/MM/AA"} value={form[key] || ""}
            onChange={e => setForm(f => ({ ...f, [key]: maskDate(e.target.value) }))}
            style={{ width: "100%" }} />
        : <input type={type} placeholder={ph} value={form[key] || ""}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            style={{ width: "100%" }} />
      }
    </div>
  );

  const parcelaPreview = isParcela && form.desc && form.totalParcelas && form.parcelaInicial
    ? (() => {
        const start = parseInt(form.parcelaInicial);
        const total = parseInt(form.totalParcelas);
        const mesIdx = MESES.indexOf(mes);
        const remaining = total - start + 1;
        const fits = Math.min(remaining, MESES.length - mesIdx);
        return { start, total, remaining, fits };
      })() : null;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {confirmDialog}

      {/* ── Modal histórico de faturas fechadas ── */}
      {modalHistorico && (
        <Modal title="📂 Histórico de Faturas Fechadas" onClose={() => setModalHistorico(false)}>
          {Object.keys(fechadas).length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>
              Nenhuma fatura fechada ainda
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
              {Object.keys(fechadas)
                .sort((a, b) => {
                  // Ordenar por mês: "bancoId:MES"
                  const [, mA] = a.split(":");
                  const [, mB] = b.split(":");
                  return MESES.indexOf(mA) - MESES.indexOf(mB);
                })
                .map(key => {
                  const [bId, mesFechado] = key.split(":");
                  const banco = bancos.find(b => b.id === bId);
                  if (!banco) return null;
                  const itensFechados = (itens[bId] || []).filter(i =>
                    i.mes === mesFechado || i.tipo === "FIXO"
                  );
                  const total = sum(itensFechados);
                  return (
                    <div
                      key={key}
                      onClick={() => {
                        setBancoSel(bId);
                        setMes(mesFechado);
                        setModalHistorico(false);
                      }}
                      style={{
                        background: banco.cor + "11",
                        border: `1px solid ${banco.cor}33`,
                        borderLeft: `3px solid ${banco.cor}`,
                        borderRadius: 8, padding: "12px 14px",
                        cursor: "pointer", transition: "all .15s",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: banco.cor }} />
                          <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13, color: banco.cor }}>
                            {banco.nome}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>{mesFechado}</span>
                          <span style={{ fontSize: 9, background: "var(--accent)22", color: "var(--accent)", border: "1px solid var(--accent)44", borderRadius: 3, padding: "1px 5px" }}>FECHADA ✅</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                          {itensFechados.length} lançamentos
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 16, color: banco.cor }}>{brl(total)}</div>
                        <div style={{ fontSize: 10, color: "var(--accent4)" }}>→ ver fatura</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Modal>
      )}

      {modalBanco && (
        <Modal title={editBanco ? "Editar Banco/Cartão" : "Novo Banco / Cartão"} onClose={() => { setModalBanco(false); setEditBanco(null); setFormBanco({ nome: "", cor: "#c084fc", vencimento: "", limite: "" }); }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Nome do Banco / Cartão</label>
            <input type="text" placeholder="Ex: Nubank, Itaú, Inter..." value={formBanco.nome} onChange={e => setFormBanco(f => ({ ...f, nome: e.target.value }))} style={{ width: "100%" }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Cor de Identificação</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {CORES_PRESET.map(c => (
                <button key={c.hex} onClick={() => setFormBanco(f => ({ ...f, cor: c.hex }))} style={{
                  width: 32, height: 32, borderRadius: "50%", background: c.hex, border: formBanco.cor === c.hex ? `3px solid white` : "3px solid transparent",
                  cursor: "pointer", outline: formBanco.cor === c.hex ? `2px solid ${c.hex}` : "none", transition: "all .15s"
                }} title={c.label} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="color" value={formBanco.cor} onChange={e => setFormBanco(f => ({ ...f, cor: e.target.value }))} style={{ width: 40, height: 32, padding: 2, borderRadius: 6, cursor: "pointer" }} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Ou escolha uma cor personalizada</span>
            </div>
            <div style={{ marginTop: 10, padding: "8px 14px", background: formBanco.cor + "18", border: `1px solid ${formBanco.cor}44`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: formBanco.cor }} />
              <span style={{ fontSize: 12, color: formBanco.cor, fontWeight: 600 }}>{formBanco.nome || "Prévia"}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Vencimento</label>
              <input type="text" placeholder="Ex: Dia 2" value={formBanco.vencimento} onChange={e => setFormBanco(f => ({ ...f, vencimento: e.target.value }))} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Limite (R$)</label>
              <input type="number" placeholder="Ex: 5000" value={formBanco.limite} onChange={e => setFormBanco(f => ({ ...f, limite: e.target.value }))} style={{ width: "100%" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={handleSaveBanco} color={formBanco.cor} style={{ flex: 1 }}>
              {editBanco ? "Salvar" : "+ Criar Cartão"}
            </Btn>
            <Btn onClick={() => { setModalBanco(false); setEditBanco(null); }} color="var(--muted)">Cancelar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal editar lançamento */}
      {modal === "edit" && editItem && (
        <Modal title="Editar Lançamento" onClose={() => { setModal(null); setEditItem(null); setForm({}); }}>
          {inp("Descrição", "desc", "text", "")}
          {inp("Data / Referência", "data", "text", "DD/MM/AA")}
          {inp("Valor (R$)", "valor", "number", "0.00")}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={handleSaveEdit} color={bancoAtual?.cor || "var(--accent)"} style={{ flex: 1 }}>Salvar</Btn>
            <Btn onClick={() => { setModal(null); setEditItem(null); setForm({}); }} color="var(--muted)">Cancelar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal lançamento */}
      {modal && modal !== "edit" && bancoAtual && (
        <Modal title={`Novo Lançamento – ${bancoAtual.nome} ${mes}`} onClose={() => { setModal(null); setForm({}); }}>
          {inp("Descrição", "desc", "text", "Ex: TÊNIS NIKE, CELULAR...")}
          {modal !== "VARIÁVEL" && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Tipo</label>
              <select value={form.tipo || "FIXO"} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={{ width: "100%" }}>
                <option value="FIXO">FIXO (mensal recorrente)</option>
                <option value="PARCELA">PARCELADO</option>
              </select>
            </div>
          )}
          {isParcela && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: bancoAtual.cor, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>📦 Configurar Parcelamento</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>PARCELA ATUAL</label>
                  <input type="number" min="1" placeholder="Ex: 1" value={form.parcelaInicial || ""} onChange={e => setForm(f => ({ ...f, parcelaInicial: e.target.value }))} style={{ width: "100%" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>TOTAL DE PARCELAS</label>
                  <input type="number" min="1" placeholder="Ex: 10" value={form.totalParcelas || ""} onChange={e => setForm(f => ({ ...f, totalParcelas: e.target.value }))} style={{ width: "100%" }} />
                </div>
              </div>
              {parcelaPreview && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: bancoAtual.cor + "11", border: `1px solid ${bancoAtual.cor}44`, borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: bancoAtual.cor, fontWeight: 600, marginBottom: 6 }}>PRÉVIA DAS PARCELAS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Array.from({ length: parcelaPreview.fits }, (_, i) => {
                      const p = parcelaPreview.start + i;
                      const mesIdx = MESES.indexOf(mes) + i;
                      const isLast = p === parcelaPreview.total;
                      return (
                        <span key={p} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: isLast ? "#ff6b6b22" : bancoAtual.cor + "22", color: isLast ? "#ff6b6b" : bancoAtual.cor, border: `1px solid ${isLast ? "#ff6b6b44" : bancoAtual.cor + "44"}` }}>
                          {MESES[mesIdx]}: {p}/{parcelaPreview.total}{isLast ? " ✓" : ""}
                        </span>
                      );
                    })}
                    {parcelaPreview.remaining > parcelaPreview.fits && (
                      <span style={{ fontSize: 10, color: "var(--muted)", padding: "2px 4px" }}>+{parcelaPreview.remaining - parcelaPreview.fits} fora do período</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {inp("Data / Referência", "data", "text", modal === "VARIÁVEL" ? "DD/MM" : "DIA 5 / FIXO")}
          {inp("Valor por parcela (R$)", "valor", "number", "0.00")}
          {isParcela && form.valor && form.totalParcelas && form.parcelaInicial && (
            <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>{parseInt(form.totalParcelas) - parseInt(form.parcelaInicial) + 1}x de {brl(parseFloat(form.valor) || 0)}</span>
              <span style={{ color: bancoAtual.cor, fontWeight: 600 }}>Total: {brl((parseFloat(form.valor) || 0) * (parseInt(form.totalParcelas) - parseInt(form.parcelaInicial) + 1))}</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={handleAdd} color={bancoAtual.cor} style={{ flex: 1 }}>{isParcela ? `✚ Criar ${parcelaPreview?.fits || "?"} parcela(s)` : "+ Adicionar"}</Btn>
            <Btn onClick={() => { setModal(null); setForm({}); }} color="var(--muted)">Cancelar</Btn>
          </div>
        </Modal>
      )}

      {/* Relógio + mês atual */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "10px 18px",
      }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
            Horário de Brasília
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 28, color: "var(--accent)", letterSpacing: -1 }}>
              {horaStr}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "capitalize" }}>{dataStr}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", borderLeft: "1px solid var(--border)", paddingLeft: 16 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
            Mês atual
          </div>
          <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 20, color: "var(--accent3)" }}>
            {mesAtual}
          </div>
        </div>
      </div>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        {/* Banco pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {bancos.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum banco criado ainda</span>
          )}
          {bancos.map(b => {
            const bItens = itens[b.id] || [];
            const fixos = bItens.filter(i => i.tipo === "FIXO");
            const mesItens = bItens.filter(i => i.mes === mes && i.tipo !== "FIXO");
            const t = sum([...fixos, ...mesItens]);
            return (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <button onClick={() => { setBancoSel(b.id); setMesManual(prev => { const n={...prev}; delete n[b.id]; return n; }); }} style={{
                  background: bancoSel === b.id ? b.cor + "22" : "var(--surface)",
                  border: `1px solid ${bancoSel === b.id ? b.cor + "66" : "var(--border)"}`,
                  color: bancoSel === b.id ? b.cor : "var(--muted)",
                  borderRadius: "8px 0 0 8px", padding: "8px 14px",
                  fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13,
                  cursor: "pointer", transition: "all .15s", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.cor }} />
                  {b.nome}
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", opacity: 0.8 }}>{brl(t)}</span>
                </button>
                <button onClick={() => openEditBanco(b)} style={{ background: "var(--surface)", border: `1px solid var(--border)`, borderLeft: "none", color: "var(--muted)", padding: "8px 8px", fontSize: 11, cursor: "pointer" }}>✎</button>
                <button onClick={() => handleDeleteBanco(b.id)} style={{ background: "var(--surface)", border: `1px solid var(--border)`, borderLeft: "none", color: "#ff6b6b", padding: "8px 8px", fontSize: 11, cursor: "pointer", borderRadius: "0 8px 8px 0" }}>✕</button>
              </div>
            );
          })}
          <Btn small onClick={() => setModalBanco(true)} color="var(--accent)">+ Banco</Btn>
          {Object.keys(fechadas).length > 0 && (
            <Btn small onClick={() => setModalHistorico(true)} color="var(--accent4)">
              📂 {Object.keys(fechadas).length} fechada{Object.keys(fechadas).length > 1 ? "s" : ""}
            </Btn>
          )}
        </div>

        {/* Meses */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {MESES.map(m => (
            <button key={m} onClick={() => setMes(m)} style={{
              background: mes === m ? (bancoAtual?.cor || "var(--accent)") + "22" : "var(--surface)",
              border: `1px solid ${mes === m ? (bancoAtual?.cor || "var(--accent)") + "66" : "var(--border)"}`,
              color: mes === m ? (bancoAtual?.cor || "var(--accent)") : "var(--muted)",
              borderRadius: 6, padding: "6px 12px", fontFamily: "var(--font-mono)", fontSize: 12,
              cursor: "pointer", transition: "all .15s",
            }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Resumo todos os bancos */}
      {bancos.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10 }}>
            {bancos.map(b => {
              const bItens = itens[b.id] || [];
              const fixos = bItens.filter(i => i.tipo === "FIXO");
              const mesItens = bItens.filter(i => i.mes === mes && i.tipo !== "FIXO");
              const t = sum([...fixos, ...mesItens]);
              return (
                <div key={b.id} onClick={() => { setBancoSel(b.id); setMesManual(prev => { const n={...prev}; delete n[b.id]; return n; }); }} style={{
                  background: bancoSel === b.id ? b.cor + "18" : "var(--surface)",
                  border: `1px solid ${bancoSel === b.id ? b.cor + "55" : "var(--border)"}`,
                  borderLeft: `3px solid ${b.cor}`,
                  borderRadius: 10, padding: "14px 18px", cursor: "pointer", transition: "all .15s",
                }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{b.nome} – {mes}</div>
                  <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 20, color: b.cor }}>{brl(t)}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                    {(itens[b.id] || []).filter(i => i.mes === mes).length} lançamentos
                    {fechadas[`${b.id}:${mes}`] && <span style={{ fontSize: 9, background: "var(--accent)22", color: "var(--accent)", border: "1px solid var(--accent)44", borderRadius: 3, padding: "1px 5px" }}>FECHADA</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 20px" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>💳 Total Geral – {mes}</span>
            <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 18, color: "var(--text)" }}>{brl(totalGeral)}</span>
          </div>

          {/* ── Barra de status da fatura ── */}
          {bancoAtual && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              background: faturaFechada ? "#4fffb011" : "#ffd16611",
              border: `1px solid ${faturaFechada ? "#4fffb044" : "#ffd16644"}`,
              borderRadius: 10, padding: "12px 18px",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: faturaFechada ? "var(--accent)" : "var(--accent3)", fontFamily: "var(--font-head)" }}>
                  {faturaFechada ? "✅ Fatura fechada" : `⚡ Fatura ${bancoAtual.nome} – ${mes} em aberto`}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                  {faturaFechada
                    ? "Visualização apenas — reabra para editar"
                    : "Feche a fatura para propagar 'NOME ao próximo mês"}
                </div>
              </div>
              {faturaFechada
                ? <Btn small onClick={handleReabrirFatura} color="var(--muted)">🔓 Reabrir</Btn>
                : <Btn small onClick={handleFecharFatura} color="var(--accent3)">🔒 Fechar Fatura</Btn>
              }
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {bancos.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
          <div style={{ fontFamily: "var(--font-head)", fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Nenhum cartão cadastrado</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Adicione seu primeiro banco ou cartão para começar a controlar suas faturas</div>
          <Btn onClick={() => setModalBanco(true)}>+ Adicionar Banco / Cartão</Btn>
        </div>
      )}

      {/* Detalhe banco selecionado */}
      {bancoAtual && (
        <FaturasBanco
          cfg={bancoAtual}
          items={itemsBanco}
          allItems={itemsBanco}
          mes={mes}
          fechada={faturaFechada}
          onAdd={faturaFechada ? null : (tipo) => { setForm({}); setModal(tipo); }}
          onDelete={faturaFechada ? null : handleDelete}
          onEdit={faturaFechada ? null : handleEditItem}
          onReorder={faturaFechada ? null : handleReorderItems}
          onToggleHide={(id) => toggleHideFatura(bancoSel, id)}
          hiddenIds={getHiddenFaturaIds(bancoSel)}
        />
      )}

      {/* Prompt to select bank */}
      {bancos.length > 0 && !bancoAtual && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontSize: 13 }}>
          ← Selecione um banco acima para ver os lançamentos
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
  { id: "gastos",    label: "Gastos",    icon: Icons.gastos    },
  { id: "saldos",    label: "Saldos",    icon: Icons.saldos    },
  { id: "devedores", label: "Devedores", icon: Icons.devedores },
  { id: "faturas",   label: "Faturas",   icon: Icons.faturas   },
];

// ─── Engine de Notificações ───────────────────────────────────────────────────
function gerarNotificacoes(data) {
  const notifs = [];
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const hoje = now.getDate();
  const mesAtual = now.getMonth(); // 0-based
  const anoAtual = now.getFullYear();

  const parseDia = (str) => {
    if (!str || str === "—") return null;
    const m = String(str).match(/\d+/);
    return m ? parseInt(m[0]) : null;
  };

  const parsePrazo = (str) => {
    // Aceita "DD/MM", "DD/MM/AA", "15/03" etc
    if (!str || str === "—") return null;
    const parts = str.split("/");
    if (parts.length < 2) return null;
    const dia = parseInt(parts[0]);
    const mes = parseInt(parts[1]) - 1; // 0-based
    const ano = parts[2] ? (parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2])) : anoAtual;
    if (isNaN(dia) || isNaN(mes)) return null;
    return new Date(ano, mes, dia);
  };

  const diffDias = (dataAlvo) => {
    if (!dataAlvo) return null;
    const diff = dataAlvo - new Date(anoAtual, mesAtual, hoje);
    return Math.round(diff / (1000 * 60 * 60 * 24));
  };

  const urgencia = (dias) => {
    if (dias === null) return null;
    if (dias < 0) return "atrasado";
    if (dias === 0) return "hoje";
    if (dias <= 1) return "amanha";
    if (dias <= 3) return "breve";
    return null; // só notifica com ≤3 dias
  };

  const corUrgencia = { atrasado: "#ff6b6b", hoje: "#ff6b6b", amanha: "#ffd166", breve: "#74b9ff" };
  const labelUrgencia = { atrasado: "ATRASADO", hoje: "HOJE", amanha: "AMANHÃ", breve: "EM BREVE" };

  // ── 1. Contas Fixas ──────────────────────────────────────────────
  (data.contaFixa || []).forEach(c => {
    const dia = parseDia(c.venc);
    if (!dia) return;
    const dataVenc = new Date(anoAtual, mesAtual, dia);
    const dias = diffDias(dataVenc);
    const u = urgencia(dias);
    if (!u) return;
    notifs.push({
      id: `conta-${c.id}`,
      tipo: "conta",
      titulo: c.desc,
      detalhe: `Vence dia ${dia} — ${brl(c.valor)}`,
      cor: corUrgencia[u],
      badge: labelUrgencia[u],
      dias,
    });
  });

  // ── 2. Fatura do cartão vencendo ─────────────────────────────────
  const faturas = data.faturas || { bancos: [], itens: {} };
  const mesLabels = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const mesLabel = `${mesLabels[mesAtual]}/${String(anoAtual).slice(2)}`;
  (faturas.bancos || []).forEach(b => {
    const dia = parseDia(b.vencimento);
    if (!dia) return;
    const dataVenc = new Date(anoAtual, mesAtual, dia);
    const dias = diffDias(dataVenc);
    const u = urgencia(dias);
    if (!u) return;
    const itensBanco = faturas.itens?.[b.id] || [];
    const fixos = itensBanco.filter(i => i.tipo === "FIXO");
    const mesItens = itensBanco.filter(i => i.mes === mesLabel);
    const total = sum([...fixos, ...mesItens]);
    notifs.push({
      id: `fatura-${b.id}`,
      tipo: "fatura",
      titulo: `Fatura ${b.nome}`,
      detalhe: `Vence dia ${dia} — ${brl(total)}`,
      cor: b.cor || corUrgencia[u],
      badge: labelUrgencia[u],
      dias,
    });
  });

  // ── 3. Devedores com prazo chegando ──────────────────────────────
  (data.devedores || []).filter(d => d.status !== "PAGO").forEach(d => {
    const dataAlvo = parsePrazo(d.prazo);
    const dias = diffDias(dataAlvo);
    const u = urgencia(dias);
    if (!u) return;
    notifs.push({
      id: `devedor-${d.id}`,
      tipo: "devedor",
      titulo: `${d.nome} — ${d.desc}`,
      detalhe: `Prazo: ${d.prazo} — ${brl(d.valor)}`,
      cor: corUrgencia[u],
      badge: labelUrgencia[u],
      dias,
    });
  });

  // ── 4. Última parcela chegando ───────────────────────────────────
  (faturas.bancos || []).forEach(b => {
    const itensBanco = faturas.itens?.[b.id] || [];
    itensBanco.forEach(item => {
      if (!isLastParcela(item.desc)) return;
      // Verifica se o mês da última parcela é o mês atual ou próximo
      const idxMes = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT"].indexOf(
        (item.mes || "").split("/")[0]
      );
      if (idxMes < 0) return;
      const diasMes = idxMes - mesAtual; // diferença em meses
      if (diasMes < 0 || diasMes > 1) return; // só mês atual ou próximo
      notifs.push({
        id: `parcela-${item.id}`,
        tipo: "parcela",
        titulo: `Última parcela: ${item.desc}`,
        detalhe: `${b.nome} — ${brl(item.valor)} — ${item.mes}`,
        cor: "#ffd166",
        badge: diasMes === 0 ? "MÊS ATUAL" : "PRÓXIMO MÊS",
        dias: diasMes * 30,
      });
    });
  });

  // Ordenar: mais urgente primeiro
  return notifs.sort((a, b) => a.dias - b.dias);
}

// ─── Painel de Notificações ───────────────────────────────────────────────────
function PainelNotificacoes({ data, onClose }) {
  const notifs = gerarNotificacoes(data);
  const tipoIcon = { conta: "📅", fatura: "💳", devedor: "👤", parcela: "🔁" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      display: "flex", justifyContent: "flex-end",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in" style={{
        width: 360, maxWidth: "100vw",
        background: "var(--surface2)", borderLeft: "1px solid var(--border)",
        height: "100vh", overflowY: "auto",
        padding: "24px 20px", display: "flex", flexDirection: "column", gap: 0,
        boxShadow: "-20px 0 60px rgba(0,0,0,0.4)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {Icons.bell("var(--accent)")}
            <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 16 }}>Notificações</span>
            {notifs.length > 0 && (
              <span style={{ background: "#ff6b6b", color: "#fff", borderRadius: "100px", padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                {notifs.length}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>✕</button>
        </div>

        {notifs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: "var(--font-head)", fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Tudo em dia!</div>
            <div style={{ fontSize: 13 }}>Nenhum vencimento nos próximos 3 dias.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notifs.map(n => (
              <div key={n.id} style={{
                background: n.cor + "0d",
                border: `1px solid ${n.cor}33`,
                borderLeft: `3px solid ${n.cor}`,
                borderRadius: 10, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{tipoIcon[n.tipo]}</span>
                    <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{n.titulo}</span>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                    background: n.cor + "22", color: n.cor, border: `1px solid ${n.cor}44`,
                    whiteSpace: "nowrap", fontFamily: "var(--font-mono)",
                  }}>{n.badge}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", paddingLeft: 24 }}>{n.detalhe}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Login Screen (Landing Page) ──────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("login");
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    let result;
    if (mode === "login") {
      result = await supabase.auth.signInWithPassword({ email, password });
    } else {
      result = await supabase.auth.signUp({ email, password });
    }
    if (result.error) setError(result.error.message);
    setLoading(false);
  };

  const features = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
      ),
      title: "Dashboard Inteligente",
      desc: "Visão completa das suas finanças em tempo real, com resumo de gastos, saldos e alertas automáticos.",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      ),
      title: "Controle de Gastos",
      desc: "Registre gastos fixos e variáveis. Categorize, filtre por mês e entenda para onde vai cada centavo.",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="M18 9l-5 5-2-2-5 5"/>
        </svg>
      ),
      title: "Saldos & Contas",
      desc: "Acompanhe o saldo de todas as suas contas bancárias e carteiras em um só lugar.",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/>
        </svg>
      ),
      title: "Controle de Devedores",
      desc: "Registre quem te deve e quanto. Nunca mais esqueça um empréstimo ou dívida pendente.",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
        </svg>
      ),
      title: "Faturas de Cartão",
      desc: "Gerencie faturas de múltiplos cartões, adicione itens e feche faturas por mês com facilidade.",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
      ),
      title: "Alertas Automáticos",
      desc: "Receba notificações sobre contas próximas do vencimento e gastos acima do esperado.",
    },
  ];

  const stats = [
    { value: "100%", label: "Seus dados, só seus" },
    { value: "∞", label: "Lançamentos" },
    { value: "0", label: "Anúncios" },
    { value: "24/7", label: "Disponível" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", overflowX: "hidden" }}>
      <GlobalStyle />
      <style>{`
        @keyframes gridMove {
          from { background-position: 0 0; }
          to { background-position: 40px 40px; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px #4fffb033, 0 0 60px #4fffb011; }
          50% { box-shadow: 0 0 40px #4fffb055, 0 0 100px #4fffb022; }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes revealUp {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 14px; border-radius: 100px;
          background: #4fffb011; border: 1px solid #4fffb033;
          font-size: 11px; color: var(--accent); letter-spacing: 1px;
          text-transform: uppercase; margin-bottom: 24px;
        }
        .hero-title {
          font-family: var(--font-head); font-weight: 800;
          font-size: clamp(40px, 7vw, 80px);
          line-height: 1.05; letter-spacing: -1px;
          color: var(--text);
        }
        .hero-title span { color: var(--accent); }
        .feature-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 28px 24px;
          transition: border-color .25s, transform .25s, box-shadow .25s;
          cursor: default;
        }
        .feature-card:hover {
          border-color: #4fffb033;
          transform: translateY(-4px);
          box-shadow: 0 20px 40px #00000044, 0 0 30px #4fffb011;
        }
        .stat-item {
          text-align: center; padding: 24px 16px;
          border-right: 1px solid var(--border);
        }
        .stat-item:last-child { border-right: none; }
        .cta-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 16px 36px; border-radius: 12px;
          background: var(--accent); color: #0a0d14;
          font-family: var(--font-head); font-weight: 700;
          font-size: 16px; letter-spacing: 0.5px;
          border: none; cursor: pointer;
          animation: glow 3s ease infinite;
          transition: transform .15s, filter .15s;
        }
        .cta-btn:hover { transform: scale(1.04); filter: brightness(1.1); }
        .modal-bg {
          position: fixed; inset: 0;
          background: #00000088; backdrop-filter: blur(8px);
          z-index: 1000; display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: fadeIn .2s ease;
        }
        .modal-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 20px; padding: 40px 36px; width: 100%; max-width: 420px;
          animation: revealUp .3s ease;
        }
        @media (max-width: 680px) {
          .features-grid { grid-template-columns: 1fr !important; }
          .stats-row { grid-template-columns: repeat(2, 1fr) !important; }
          .stat-item { border-right: none; border-bottom: 1px solid var(--border); }
          .modal-card { padding: 28px 20px; }
        }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: "1px solid var(--border)",
        background: "#0a0d14cc", backdropFilter: "blur(16px)",
        padding: "0 32px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 10px var(--accent)", animation: "glow 3s infinite" }} />
            <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>FOCO7</span>
            <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 2 }}>by @pecora.77</span>
          </div>
          <button className="cta-btn" onClick={() => setShowModal(true)}
            style={{ padding: "9px 22px", fontSize: 13, borderRadius: 8 }}>
            Entrar →
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: "relative", overflow: "hidden",
        padding: "100px 32px 80px", textAlign: "center",
      }}>
        {/* Grid background */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          animation: "gridMove 8s linear infinite",
          opacity: 0.3,
        }} />
        {/* Radial glow */}
        <div style={{
          position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
          width: 600, height: 400,
          background: "radial-gradient(ellipse at center, #4fffb018 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", maxWidth: 780, margin: "0 auto", animation: "revealUp .6s ease both" }}>
          <div className="hero-badge">
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
            Controle financeiro pessoal
          </div>
          <h1 className="hero-title">
            Suas finanças,<br /><span>sob controle.</span>
          </h1>
          <p style={{ marginTop: 24, fontSize: 18, color: "var(--muted)", lineHeight: 1.7, maxWidth: 560, margin: "24px auto 0" }}>
            Tudo que você precisa para organizar gastos, saldos, faturas e devedores — em um app simples, rápido e seguro.
          </p>
          <div style={{ marginTop: 40, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cta-btn" onClick={() => setShowModal(true)}>
              Começar agora
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 28px", borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 15, fontFamily: "var(--font-mono)" }}>
              Ver funcionalidades
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ padding: "0 32px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
            {stats.map((s, i) => (
              <div className="stat-item" key={i}>
                <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 36, color: "var(--accent)" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: "60px 32px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div className="hero-badge" style={{ display: "inline-flex" }}>Funcionalidades</div>
            <h2 style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: "clamp(28px, 4vw, 44px)", color: "var(--text)" }}>
              Tudo que você precisa,<br />nada que você não precisa.
            </h2>
          </div>
          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {features.map((f, i) => (
              <div className="feature-card" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
                <div style={{ marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 17, marginBottom: 10, color: "var(--text)" }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: "40px 32px 80px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{
            background: "var(--surface)", border: "1px solid #4fffb022",
            borderRadius: 24, padding: "60px 40px",
            boxShadow: "0 0 80px #4fffb00a",
          }}>
            <h2 style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: "clamp(24px, 4vw, 36px)", color: "var(--text)", marginBottom: 12 }}>
              Pronto para começar?
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 32, lineHeight: 1.7 }}>
              Acesse agora e tenha controle total sobre suas finanças pessoais.
            </p>
            <button className="cta-btn" onClick={() => setShowModal(true)} style={{ fontSize: 16 }}>
              Entrar / Criar conta
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "24px 32px", textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>FOCO7</span>
        <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 12 }}>by @pecora.77 · {new Date().getFullYear()}</span>
      </footer>

      {/* ── Modal de Login/Cadastro ── */}
      {showModal && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 10px var(--accent)" }} />
                <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>FOCO7</span>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>
              {mode === "login" ? "Entre na sua conta para continuar" : "Crie sua conta para começar"}
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>E-mail</label>
              <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%" }} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Senha</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%" }} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            {error && <div style={{ color: "var(--accent2)", fontSize: 12, marginBottom: 14, padding: "8px 12px", background: "#ff6b6b11", border: "1px solid #ff6b6b33", borderRadius: 6 }}>{error}</div>}
            <Btn onClick={handleSubmit} style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar Conta"}
            </Btn>
            <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
              {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
              <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                {mode === "login" ? "Criar conta" : "Entrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [session, setSession] = useState(undefined);
  const userId = session?.user?.id ?? null;
  const [data, setData, loading] = useStorage("financas-v1", SEED, userId);
  const [painelNotif, setPainelNotif] = useState(false);

  useEffect(() => {
    // Verifica sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    // Escuta mudanças (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Ainda verificando sessão
  if (session === undefined) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <GlobalStyle />
      <div className="loading" style={{ fontFamily: "var(--font-head)", fontSize: 18, color: "var(--accent)" }}>Carregando...</div>
    </div>
  );

  // Não logado → mostra tela de login
  if (!session) return <LoginScreen />;

  // Logado mas dados ainda carregando
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <GlobalStyle />
      <div className="loading" style={{ fontFamily: "var(--font-head)", fontSize: 18, color: "var(--accent)" }}>Carregando...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-mono)" }}>
      <GlobalStyle />

      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
            <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 16, letterSpacing: 1 }}>FOCO7</span>
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>by @pecora.77</span>
          </div>
          <div className="top-tabs" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: tab === t.id ? "var(--accent)18" : "none",
                border: tab === t.id ? "1px solid var(--accent)44" : "1px solid transparent",
                color: tab === t.id ? "var(--accent)" : "var(--muted)",
                borderRadius: 6, padding: "6px 12px", fontSize: 12, fontFamily: "var(--font-mono)",
                cursor: "pointer", transition: "all .15s",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {t.icon(tab === t.id ? "var(--accent)" : "var(--muted)")}{t.label}
              </button>
            ))}
            {/* Sino de notificações */}
            {data && (() => {
              const n = gerarNotificacoes(data);
              return (
                <button onClick={() => setPainelNotif(true)} style={{
                  position: "relative", background: "none", border: "1px solid var(--border)",
                  color: "var(--muted)", borderRadius: 6, padding: "6px 10px",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  transition: "all .15s",
                }}>
                  {Icons.bell(n.length > 0 ? "#ff6b6b" : "var(--muted)")}
                  {n.length > 0 && (
                    <span style={{
                      position: "absolute", top: -5, right: -5,
                      background: "#ff6b6b", color: "#fff",
                      borderRadius: "100px", width: 16, height: 16,
                      fontSize: 9, fontWeight: 700, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      border: "2px solid var(--surface)",
                    }}>{n.length}</span>
                  )}
                </button>
              );
            })()}
            <button className="top-logout" onClick={handleLogout} style={{
              marginLeft: 8, background: "#ff6b6b11", border: "1px solid #ff6b6b33",
              color: "#ff6b6b", borderRadius: 6, padding: "6px 12px",
              fontSize: 12, fontFamily: "var(--font-mono)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {Icons.logout("#ff6b6b")} Sair
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="page-pad" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {tab === "dashboard"  && <Dashboard data={data} />}
        {tab === "gastos"     && <Gastos data={data} setData={setData} />}
        {tab === "saldos"     && <Saldos data={data} setData={setData} />}
        {tab === "devedores"  && <Devedores data={data} setData={setData} />}
        {tab === "faturas"    && <Faturas data={data} setData={setData} />}
      </div>

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="bottom-nav">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 3, background: "none", border: "none",
              color: active ? "var(--accent)" : "var(--muted)",
              padding: "6px 0", borderRadius: 8, position: "relative",
            }}>
              {active && (
                <div style={{
                  position: "absolute", top: 0, left: "20%", right: "20%",
                  height: 2, background: "var(--accent)", borderRadius: "0 0 2px 2px"
                }} />
              )}
              <div style={{ transform: active ? "scale(1.15)" : "scale(1)", transition: "transform .15s" }}>
                {t.icon(active ? "var(--accent)" : "var(--muted)")}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{t.label}</span>
            </button>
          );
        })}
        {/* Sino mobile */}
        {data && (() => {
          const n = gerarNotificacoes(data);
          return (
            <button onClick={() => setPainelNotif(true)} style={{
              position: "relative", width: 44, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3,
              background: "none", border: "none",
              color: n.length > 0 ? "#ff6b6b" : "var(--muted)",
              padding: "6px 4px", borderRadius: 8,
            }}>
              {Icons.bell(n.length > 0 ? "#ff6b6b" : "var(--muted)")}
              {n.length > 0 && (
                <span style={{
                  position: "absolute", top: 2, right: 4,
                  background: "#ff6b6b", color: "#fff", borderRadius: "100px",
                  width: 14, height: 14, fontSize: 8, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid var(--surface)",
                }}>{n.length}</span>
              )}
              <span style={{ fontSize: 9 }}>Alertas</span>
            </button>
          );
        })()}
        <button onClick={handleLogout} style={{
          width: 44, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 3, background: "none", border: "none",
          color: "#ff6b6b55", padding: "6px 4px", borderRadius: 8,
        }}>
          {Icons.logout("#ff6b6b55")}
          <span style={{ fontSize: 9 }}>Sair</span>
        </button>
      </nav>
      {/* Painel de notificações */}
      {painelNotif && data && (
        <PainelNotificacoes data={data} onClose={() => setPainelNotif(false)} />
      )}
    </div>
  );
}
