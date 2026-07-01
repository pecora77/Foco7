import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { createPortal } from "react-dom";
import { supabase } from "./supabase.js";

// ─── Palette & fonts via inline style injection ──────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:          #0c0c0c;
      --surface:     #141414;
      --surface2:    #1a1a1a;
      --surface3:    #212121;
      --border:      #2c2c2c;
      --border2:     #383838;
      --accent:      #f97316;
      --accent2:     #ea580c;
      --accent3:     #fb923c;
      --accent-glow: rgba(249,115,22,0.18);
      --red:         #ef4444;
      --green:       #22c55e;
      --yellow:      #eab308;
      --blue:        #3b82f6;
      --purple:      #a855f7;
      --text:        #f4f4f5;
      --text2:       #a1a1aa;
      --muted:       #52525b;
      --radius:      14px;
      --radius-sm:   10px;
      --radius-lg:   18px;
      --shadow:      0 4px 24px rgba(0,0,0,0.6);
      --shadow-lg:   0 8px 48px rgba(0,0,0,0.8);
      --font-head:   'Inter', sans-serif;
      --font-body:   'Inter', sans-serif;
      --font-mono:   'DM Mono', monospace;
      --sidebar-w:   220px;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      line-height: 1.5;
      background-image: radial-gradient(ellipse 90% 50% at 50% -5%, rgba(249,115,22,0.1) 0%, transparent 55%);
      background-attachment: fixed;
    }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }
    input, select, textarea {
      background: var(--surface3); border: 1px solid var(--border);
      color: var(--text); font-family: var(--font-body);
      border-radius: var(--radius-sm); padding: 10px 14px;
      font-size: 14px; outline: none;
      transition: border-color .2s, box-shadow .2s; width: 100%;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
    input::placeholder, textarea::placeholder { color: var(--muted); font-size: 13px; }
    select option { background: var(--surface2); }
    button { cursor: pointer; font-family: var(--font-body); transition: all .18s; }
    button:active { transform: scale(0.97); }

    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes slideUp { from { transform:translateY(50px); opacity:0; } to { transform:translateY(0); opacity:1; } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
    @keyframes toastIn { from { transform:translateX(110%); opacity:0; } to { transform:translateX(0); opacity:1; } }
    @keyframes toastOut { from { transform:translateX(0); opacity:1; } to { transform:translateX(110%); opacity:0; } }
    .fade-in { animation: fadeIn .3s ease both; }
    .loading { animation: pulse 1.5s infinite; }

    /* ── Sidebar layout ── */
    .app-layout { display: flex; min-height: 100vh; }
    .sidebar {
      width: var(--sidebar-w); min-height: 100vh;
      background: var(--surface); border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
      position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
    }
    .main-content { margin-left: var(--sidebar-w); flex: 1; min-height: 100vh; }

    /* ── Toasts ── */
    .toast-wrap { position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
    .toast { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: var(--radius-sm); background: var(--surface2); border: 1px solid var(--border2); font-size: 13px; box-shadow: var(--shadow-lg); animation: toastIn .3s ease both; min-width: 240px; pointer-events: all; }
    .toast.exit { animation: toastOut .3s ease forwards; }
    .toast-success { border-color: var(--accent); }
    .toast-error { border-color: var(--red); }
    .toast-info { border-color: var(--blue); }

    .card-hover { transition: border-color .2s, transform .2s, box-shadow .2s; }
    .card-hover:hover { border-color: var(--border2) !important; transform: translateY(-1px); box-shadow: var(--shadow); }

    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { text-align: left; padding: 10px 16px; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid var(--border); background: var(--surface); font-family: var(--font-mono); }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
    .data-table tbody tr { transition: background .15s; }
    .data-table tbody tr:hover { background: rgba(249,115,22,0.05); }
    .data-table tbody tr:last-child td { border-bottom: none; }

    .form-label { display: block; font-size: 11px; font-weight: 600; color: var(--text2); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.6px; font-family: var(--font-mono); }
    .form-group { margin-bottom: 14px; }

    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 22px; min-width: 0; }

    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; font-family: var(--font-mono); white-space: nowrap; }

    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px; text-align: center; color: var(--muted); }
    .empty-state-icon { font-size: 40px; margin-bottom: 14px; opacity: 0.5; }
    .empty-state-title { font-weight: 700; font-size: 16px; color: var(--text2); margin-bottom: 8px; }
    .empty-state-desc { font-size: 13px; max-width: 280px; line-height: 1.6; }

    .sec-head { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
    .sec-head-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .sec-head-title { font-weight: 700; font-size: 15px; color: var(--text); }

    .progress-bar { height: 5px; background: var(--surface3); border-radius: 99px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 99px; transition: width .6s cubic-bezier(.4,0,.2,1); }

    .seg-control { display: inline-flex; background: var(--surface3); border-radius: var(--radius-sm); padding: 3px; border: 1px solid var(--border); }
    .seg-btn { padding: 6px 14px; border-radius: 8px; border: none; font-size: 12px; font-weight: 600; color: var(--muted); background: transparent; }
    .seg-btn.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,0.4); }

    /* ── Mobile ── */
    .bottom-nav { display: none; }
    .top-tabs { display: flex; }
    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main-content { margin-left: 0; }
      .bottom-nav { display: flex; align-items: center; justify-content: space-around; position: fixed; bottom: 0; left: 0; right: 0; height: 64px; background: var(--surface); border-top: 1px solid var(--border); z-index: 200; padding-bottom: env(safe-area-inset-bottom); }
      .top-tabs, .top-logout { display: none !important; }
      .page-pad { padding: 14px 12px !important; padding-bottom: calc(76px + env(safe-area-inset-bottom)) !important; }
      .modal-overlay { align-items: flex-end !important; padding: 0 !important; }
      .modal-box { border-radius: 20px 20px 0 0 !important; max-width: 100% !important; min-width: 0 !important; max-height: 92vh; overflow-y: auto; animation: slideUp .25s ease both !important; }
      .grid-2 { grid-template-columns: 1fr !important; }
      .stat-grid { grid-template-columns: repeat(2,1fr) !important; }
      .data-table th, .data-table td { padding: 8px 10px !important; font-size: 11.5px !important; }
      .hide-m { display: none !important; }
      .toast-wrap { bottom: 76px; right: 12px; left: 12px; }
    }
  `}</style>
);

// ─── Dados iniciais (vazio para novos usuários) ───────────────────────────────
const CATEGORIAS = [
  { id: "fastfood",     label: "Fast Food",       cor: "#ef4444", icon: "🍔", keys: ["ifood","uber eats","rappi","mcdonalds","burger king","bob's","subway","pizza hut","dominos","habibs","giraffas","madero","kfc","popeyes","hamburger","burguer","lanche"] },
  { id: "alimentacao",  label: "Alimentação",     cor: "#f97316", icon: "🍽️", keys: ["supermercado","mercado","padaria","acougue","hortifruti","feira","pao de acucar","extra","carrefour","zaffari","angeloni","sonda","atacadao","assai","boteco","restaurante","lanchonete","pizza","refeicao","almoco","jantar","cafe"] },
  { id: "assinatura",   label: "Assinaturas",     cor: "#8b5cf6", icon: "📺", keys: ["netflix","spotify","amazon prime","hbo","disney","globoplay","apple tv","deezer","youtube premium","crunchyroll","paramount","star+","telecine","adobe","canva","notion","figma","chatgpt","openai","microsoft 365","office 365","google one","icloud","dropbox","kindle","audible","twitch"] },
  { id: "transporte",   label: "Transporte",      cor: "#06b6d4", icon: "🚗", keys: ["uber","99","cabify","onibus","metro","trem","brt","combustivel","gasolina","etanol","diesel","posto","shell","petrobras","ipiranga","ale","estacionamento","pedagio","detran","seguro auto"] },
  { id: "saude",        label: "Saúde",           cor: "#10b981", icon: "💊", keys: ["farmacia","drogasil","droga raia","ultrafarma","panvel","nissei","pacheco","drogaria","hospital","clinica","medico","dentista","exame","laboratorio","unimed","amil","plano de saude","academia","smart fit","bluefit","gympass","wellhub","fisioterapia","psicologo","nutricionista"] },
  { id: "educacao",     label: "Educação",        cor: "#3b82f6", icon: "📚", keys: ["escola","faculdade","universidade","curso","alura","udemy","coursera","duolingo","wizard","ccaa","cultura inglesa","livraria","papelaria","material escolar","mensalidade"] },
  { id: "lazer",        label: "Lazer",           cor: "#ec4899", icon: "🎮", keys: ["cinema","teatro","show","concerto","ingresso","ticketmaster","sympla","steam","playstation","xbox","nintendo","epic games","parque","viagem","hotel","airbnb","booking","decolar","clube"] },
  { id: "vestuario",    label: "Vestuário",       cor: "#f59e0b", icon: "👕", keys: ["zara","hm","h&m","renner","riachuelo","c&a","marisa","nike","adidas","vans","puma","fila","arezzo","shein","netshoes","centauro","decathlon"] },
  { id: "tecnologia",   label: "Tecnologia",      cor: "#6366f1", icon: "💻", keys: ["amazon","americanas","magalu","shopee","mercado livre","aliexpress","kabum","terabyte","pichau","dell","apple","samsung","celular","notebook","computador","tablet","iphone","ipad","airpods","galaxy","fone","teclado","mouse","monitor"] },
  { id: "moradia",      label: "Moradia",         cor: "#84cc16", icon: "🏠", keys: ["aluguel","condominio","iptu","energia","enel","cemig","copel","coelba","agua","sabesp","embasa","gas","comgas","internet","vivo","claro","tim","oi","manutencao","reforma","leroy","telhanorte"] },
  { id: "outras_pessoas", label: "Outras Pessoas",  cor: "#5d23a0", icon: "👥", keys: ["presente","gift","aniversario","casamento","chá","bebe","amigo","colega","namorad","esposa","marido","filho","filha","mae","pai","familia","vaquinha","contribuicao","doacao"] },
  { id: "outros",       label: "Outros",          cor: "#6b7280", icon: "📦", keys: [] },
];

const detectarCategoria = (desc) => {
  if (!desc) return null;
  const d = desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const cat of CATEGORIAS) {
    if (cat.id === "outros") continue;
    if (cat.keys.some(k => d.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) return cat.id;
  }
  return null;
};
const getCat = (id) => CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];

const SEED = {
  gastoFixo: [],
  contaFixa: [],
  gastoVar: [],
  saldos: [],
  devedores: [],
  faturas: { bancos: [], itens: {}, fechadas: {} },
  parcelasPagas: {},
  notifDispensadas: [],
  contaFixaPago: {},    // { contaId: true } — resetado dia 5
  contaFixaReserva: {}, // { contaId: true } — reserva de dinheiro
  contaFixaResetMes: "", // "MM/YYYY" do último reset
  fluxo: {}, // { "MES": { entradas: [], saidas: [] } }
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
  // Nav — traço único, ultra-limpo
  dashboard: (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>,
  gastos: (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v1m0 8v1M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-1 2-2.5 2.5S9 13.5 9 15a2.5 2.5 0 0 0 5 0"/>
  </svg>,
  saldos: (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
    <path d="M16 3H8L6 7h12l-2-4z"/><circle cx="12" cy="13" r="2"/>
  </svg>,
  devedores: (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
    <path d="M16 3.5a3 3 0 0 1 0 5.5M19 20c0-2.8-1.8-5.2-4.3-6.1"/>
  </svg>,
  faturas: (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/>
    <path d="M7 15h2m4 0h2"/>
  </svg>,

  // Ações — minimalistas, sem ruído
  logout: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 17l5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
  </svg>,
  trash: (c="currentColor") => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16"/><path d="M10 11v6m4-6v6"/><path d="M6 6l1 14h10L18 6"/>
    <path d="M9 6V4h6v2"/>
  </svg>,
  edit: (c="currentColor") => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>,
  eyeOn: (c="currentColor") => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>
  </svg>,
  eyeOff: (c="currentColor") => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.9 17.9A10 10 0 0 1 12 20C5.6 20 2 12 2 12a17.6 17.6 0 0 1 4.1-5.5M9.9 4.2A9 9 0 0 1 12 4c6.4 0 10 8 10 8a17.8 17.8 0 0 1-2.1 3.1"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>,
  bell: (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>,
  fluxo: (c="currentColor") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16V8m0 0L4 11m3-3 3 3"/><path d="M17 8v8m0 0 3-3m-3 3-3-3"/>
    <rect x="2" y="3" width="20" height="18" rx="2"/>
  </svg>,

  // Seções internas
  receipt: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2h16v20l-2-1.5L16 22l-2-1.5L12 22l-2-1.5L8 22l-2-1.5L4 22V2z"/>
    <path d="M8 7h8M8 11h8M8 15h4"/>
  </svg>,
  chart: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/><path d="M7 16l4-5 4 3 4-6"/>
  </svg>,
  target: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill={c}/>
  </svg>,
  pieChart: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.2 15A9 9 0 1 1 9 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
  </svg>,
  barChart: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 20h18M8 20V8m4 12V4m4 16v-6"/>
  </svg>,
  wallet: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
    <path d="M16 3H8L6 7h12l-2-4z"/><circle cx="17" cy="13" r="1" fill={c}/>
  </svg>,
  repeat: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>,
  users: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
    <path d="M15 4a3 3 0 0 1 0 6M20 20c0-2.8-1.8-5.2-4.3-6.1"/>
  </svg>,
  creditCard: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M6 15h3"/>
  </svg>,
  shoppingBag: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>,
  building: (c="currentColor") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21V7l9-4 9 4v14"/><path d="M9 21V12h6v9"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01"/>
  </svg>,
};

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
// ─── Toast System ─────────────────────────────────────────────────────────────
const ToastContext = ({ children }) => children;
let _toastFn = null;
const toast = {
  success: (msg) => _toastFn?.("success", msg),
  error: (msg) => _toastFn?.("error", msg),
  info: (msg) => _toastFn?.("info", msg),
};

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  _toastFn = (type, msg) => {
    const id = Date.now();
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  const colors = { success: "var(--accent)", error: "var(--red)", info: "var(--blue)" };
  return (
    <>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span style={{ color: colors[t.type], fontWeight: 700, fontSize: 14 }}>{icons[t.type]}</span>
            <span style={{ color: "var(--text)", fontSize: 13 }}>{t.msg}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel, requireText }) {
  const [typed, setTyped] = useState("");
  const canConfirm = requireText ? typed === requireText : true;
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      backdropFilter: "blur(12px)", zIndex: 2000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div className="fade-in" style={{
        background: "var(--surface)", border: "1.5px solid var(--red)33",
        borderRadius: "var(--radius-lg)", padding: "28px 28px 24px",
        maxWidth: 400, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.7)",
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--red)15", border: "1px solid var(--red)33", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: requireText ? 16 : 24, lineHeight: 1.6 }}>{message}</p>
        {requireText && (
          <div className="form-group">
            <label className="form-label">Digite <span style={{ color: "var(--red)" }}>{requireText}</span> para confirmar</label>
            <input autoFocus type="text" value={typed} onChange={e => setTyped(e.target.value)} placeholder={requireText}
              style={{ borderColor: typed === requireText ? "var(--accent)" : "var(--border)" }} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, background: "var(--surface3)", border: "1.5px solid var(--border)",
            color: "var(--text2)", borderRadius: "var(--radius-sm)", padding: "10px", fontSize: 13, fontFamily: "var(--font-body)", fontWeight: 600
          }}>Cancelar</button>
          <button onClick={onConfirm} disabled={!canConfirm} style={{
            flex: 1, background: canConfirm ? "var(--red)22" : "var(--surface3)",
            border: `1.5px solid ${canConfirm ? "var(--red)55" : "var(--border)"}`,
            color: canConfirm ? "var(--red)" : "var(--muted)",
            borderRadius: "var(--radius-sm)", padding: "10px", fontSize: 13,
            fontFamily: "var(--font-body)", fontWeight: 700,
            cursor: canConfirm ? "pointer" : "not-allowed",
          }}>Confirmar</button>
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
const Card = ({ children, style, hover = false }) => (
  <div className={hover ? "card-hover" : ""} style={{
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "22px 24px",
    ...style
  }}>{children}</div>
);

const Tag = ({ color, children, size = "sm" }) => (
  <span className="badge" style={{
    background: color + "18", color, border: `1px solid ${color}33`,
    fontSize: size === "sm" ? 10 : 11,
  }}>{children}</span>
);

const Btn = ({ onClick, children, color = "var(--accent)", small, danger, solid, style, disabled }) => {
  const c = danger ? "var(--red)" : color;
  const isAccent = c === "var(--accent)" || c === "#f97316";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: solid
          ? (isAccent ? "linear-gradient(135deg, var(--accent), var(--accent2))" : c)
          : c + "15",
        border: solid ? "none" : `1px solid ${c}33`,
        color: solid ? "#fff" : c,
        borderRadius: "var(--radius-sm)",
        padding: small ? "5px 12px" : "9px 18px",
        fontSize: small ? 12 : 13,
        fontWeight: 600,
        fontFamily: "var(--font-body)",
        display: "inline-flex", alignItems: "center", gap: 6,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        boxShadow: solid && isAccent ? "0 4px 14px rgba(249,115,22,0.35)" : "none",
        transition: "all .18s",
        ...style,
      }}
      onMouseOver={e => { if(!disabled) { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
      onMouseOut={e => { if(!disabled) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; } }}
    >{children}</button>
  );
};

const StatBox = ({ label, value, color = "var(--accent)", sub, icon }) => (
  <div className="stat-card card-hover" style={{ position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: color, opacity: 0.07, filter: "blur(20px)", pointerEvents: "none" }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
      <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>{label}</span>
      {icon && (
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${color}30, ${color}15)`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
          {icon}
        </div>
      )}
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5, wordBreak: "break-word" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color, marginTop: 6, fontWeight: 500 }}>{sub}</div>}
  </div>
);

const SectionHead = ({ icon, title, color = "var(--accent)", action }) => (
  <div className="sec-head">
    {icon && (
      <div className="sec-head-icon" style={{ background: color + "15", border: `1px solid ${color}33` }}>
        <span style={{ color, display: "flex", alignItems: "center" }}>
          {typeof icon === "function" ? icon(color) : icon}
        </span>
      </div>
    )}
    <h2 className="sec-head-title">{title}</h2>
    {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
  </div>
);

function Modal({ title, onClose, children, size = "md" }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const maxW = size === "lg" ? 600 : 480;

  return createPortal(
    <div className="modal-overlay" style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", overflowY: "auto",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: "var(--radius-lg)", padding: "0",
        minWidth: 320, maxWidth: maxW, width: "100%",
        position: "relative", margin: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
      }}>
        {/* Drag handle (mobile) */}
        <div style={{ width: 36, height: 4, background: "var(--border2)", borderRadius: 99, margin: "14px auto 0" }} />
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 24px 14px", borderBottom: "1px solid var(--border)",
        }}>
          <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "var(--surface3)", border: "1px solid var(--border)",
            color: "var(--text2)", fontSize: 16, cursor: "pointer",
            width: 28, height: 28, borderRadius: 8, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
        {/* Body */}
        <div style={{ padding: "20px 24px 24px" }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

function RowTable({ cols, rows, onDelete, onEdit, onReorder, onToggleHide, hiddenIds = [], accent = "var(--accent)" }) {
  const [confirm, confirmDialog] = useConfirm();
  const drag = onReorder ? useDragSort(rows, onReorder) : null;

  if (rows.length === 0) return (
    <div className="empty-state" style={{ padding: "36px 20px" }}>
      <div className="empty-state-icon">📭</div>
      <div className="empty-state-title">Nenhum item ainda</div>
      <div className="empty-state-desc">Adicione o primeiro item usando o botão acima</div>
    </div>
  );

  return (
    <div style={{ overflowX: "auto", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
      {confirmDialog}
      <table className="data-table">
        <thead>
          <tr>
            {onReorder && <th style={{ width: 24, textAlign: "center" }}></th>}
            {cols.map(c => <th key={c.key} style={{ textAlign: c.right ? "right" : "left" }}>{c.label}</th>)}
            {(onDelete || onEdit || onToggleHide) && <th style={{ width: 100 }}></th>}
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
                style={{ opacity: isHidden ? 0.4 : 1, cursor: onReorder ? "grab" : "default" }}
              >
                {onReorder && (
                  <td style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, cursor: "grab" }}>⠿</td>
                )}
                {cols.map(c => (
                  <td key={c.key} style={{
                    textAlign: c.right ? "right" : "left",
                    color: isHidden ? "var(--muted)" : (c.color ? c.color(row) : "var(--text)"),
                    textDecoration: isHidden ? "line-through" : "none",
                    fontWeight: c.bold ? 600 : 400,
                  }}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
                {(onDelete || onEdit || onToggleHide) && (
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      {onToggleHide && (
                        <button title={isHidden ? "Mostrar" : "Ocultar"} onClick={() => onToggleHide(row.id ?? i)}
                          style={{ background: isHidden ? "var(--red)22" : "var(--surface3)", border: `1px solid ${isHidden ? "var(--red)44" : "var(--border)"}`, borderRadius: 6, padding: "5px 8px", display: "flex", alignItems: "center" }}>
                          {isHidden ? Icons.eyeOff() : Icons.eyeOn()}
                        </button>
                      )}
                      {onEdit && (
                        <button onClick={() => onEdit(row)}
                          style={{ background: "var(--accent4)11", border: "1px solid var(--accent4)33", borderRadius: 6, padding: "5px 8px", display: "flex", alignItems: "center" }}>
                          {Icons.edit()}
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => confirm({ title: "Excluir item", message: `Deseja excluir "${row.desc || row.conta || row.nome || "este item"}"?`, onConfirm: () => onDelete(row.id) })}
                          style={{ background: "var(--red)11", border: "1px solid var(--red)33", borderRadius: 6, padding: "5px 8px", display: "flex", alignItems: "center" }}>
                          {Icons.trash("var(--red)")}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── CatCard — Gastos por Categoria com acordeão ─────────────────────────────
function CatCard({ catData, itensPorCat, total }) {
  const [abertos, setAbertos] = useState({});
  const toggle = (id) => setAbertos(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <Card>
      <SectionHead icon={Icons.pieChart("currentColor")} title="Gastos por Categoria" />
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, marginTop: -10 }}>Divisão percentual de onde vai seu dinheiro este mês</div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
            {catData.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        {catData.map(c => (
          <div key={c.name}>
            {/* Linha da categoria — clicável */}
            <div
              onClick={() => toggle(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 8px", borderRadius: 8, transition: "background .15s", userSelect: "none" }}
              onMouseOver={e => e.currentTarget.style.background = c.color + "10"}
              onMouseOut={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 13 }}>{c.icon}</span>
              <span style={{ fontSize: 12, color: "var(--text2)", flex: 1 }}>{c.name}</span>
              <span style={{ fontSize: 12, color: c.color, fontWeight: 700, fontFamily: "var(--font-head)" }}>{brl(c.value)}</span>
              <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 4, transition: "transform .2s", display: "inline-block", transform: abertos[c.id] ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
            </div>
            {/* Barra de progresso */}
            <div style={{ paddingLeft: 8, paddingRight: 8, marginBottom: 2 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(c.value/total)*100}%`, background: c.color }} />
              </div>
            </div>
            {/* Acordeão — lista de compras */}
            {abertos[c.id] && (
              <div style={{ margin: "4px 8px 8px", background: c.color + "0a", border: `1px solid ${c.color}22`, borderRadius: 8, overflow: "hidden" }}>
                {(itensPorCat[c.id] || []).map((item, idx) => (
                  <div key={item.id ?? idx} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 12px",
                    borderBottom: idx < (itensPorCat[c.id].length - 1) ? `1px solid ${c.color}15` : "none",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.desc}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{item._fonte}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: c.color, fontFamily: "var(--font-mono)", marginLeft: 12, whiteSpace: "nowrap" }}>{brl(item.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Dashboard Chart Tooltip ─────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, prefix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontFamily: "var(--font-mono)", boxShadow: "var(--shadow)" }}>
      {label && <div style={{ color: "var(--text2)", marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "var(--text)", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
          {prefix}{typeof p.value === "number" ? brl(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

// ─── TAB: Dashboard ───────────────────────────────────────────────────────────
function Dashboard({ data }) {
  const mesAtual = getMesAtual();
  const totalSaldo = sum(data.saldos, "saldo");
  const totalContasFixas = sum(data.contaFixa);
  const totalGastoVar = sum(data.gastoVar);
  const totalDevedores = sum(data.devedores.filter(d => d.status !== "PAGO"));
  const faturas = data.faturas || { bancos: [], itens: {} };
  const totalFatura = (faturas.bancos || []).reduce((acc, b) => {
    const bItens = faturas.itens?.[b.id] || [];
    const fixos = bItens.filter(i => i.tipo === "FIXO");
    const mesItens = bItens.filter(i => i.mes === mesAtual && i.tipo !== "FIXO");
    return acc + sum([...fixos, ...mesItens]);
  }, 0);
  const totalParcelasFixo = sum(data.gastoFixo);
  const totalSaidas = totalContasFixas + totalGastoVar + totalParcelasFixo + totalFatura;
  const saldo_liquido = totalSaldo - totalSaidas;

  // Dados para gráfico de pizza — gastos por categoria
  const pieData = [
    { name: "Contas Fixas", value: totalContasFixas, color: "#5b9cf6" },
    { name: "Parcelas", value: totalParcelasFixo, color: "#a78bfa" },
    { name: "Variáveis", value: totalGastoVar, color: "#f7c843" },
    { name: "Faturas", value: totalFatura, color: "#00e5a0" },
  ].filter(d => d.value > 0);

  // Dados para gráfico de barras — entrada vs saída
  const barData = [
    { name: "Saldo", Entrada: totalSaldo, Saída: totalSaidas },
  ];

  const devedoresPend = data.devedores.filter(d => d.status !== "PAGO");
  const devedoresByName = devedoresPend.reduce((acc, d) => {
    acc[d.nome] = (acc[d.nome] || 0) + d.valor;
    return acc;
  }, {});

  const CHART_COLORS = ["#5b9cf6", "#a78bfa", "#f7c843", "#00e5a0", "#ff5c7a", "#22d3ee"];

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Hero row — estilo Lava ── */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius-lg)", padding: "28px 32px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
        {/* Glow laranja de fundo */}
        <div style={{ position: "absolute", top: -40, left: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>Saldo Total</div>
          <div style={{ fontWeight: 800, fontSize: 36, letterSpacing: -1, color: "var(--text)", lineHeight: 1 }}>{brl(totalSaldo)}</div>
          <div style={{ fontSize: 12, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: saldo_liquido >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
              {saldo_liquido >= 0 ? "▲" : "▼"} {brl(Math.abs(saldo_liquido))}
            </span>
            <span style={{ color: "var(--muted)" }}>saldo líquido</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", position: "relative" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>Total Saídas</div>
            <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: -0.5, color: "var(--red)" }}>{brl(totalSaidas)}</div>
          </div>
          <div style={{ width: 1, background: "var(--border)" }} />
          <div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>A Receber</div>
            <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: -0.5, color: "var(--yellow)" }}>{brl(totalDevedores)}</div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <StatBox label="Saldos" value={brl(totalSaldo)} color="var(--accent)" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21V12h6v9"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01"/></svg>} />
        <StatBox label="Contas Fixas" value={brl(totalContasFixas)} color="var(--blue)" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h16v20l-2-1.5L16 22l-2-1.5L12 22l-2-1.5L8 22l-2-1.5L4 22V2z"/><path d="M8 7h8M8 11h8M8 15h4"/></svg>} />
        <StatBox label="Variáveis" value={brl(totalGastoVar)} color="var(--yellow)" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>} />
        <StatBox label="Faturas" value={brl(totalFatura)} color="var(--purple)" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M6 15h3"/></svg>} sub={mesAtual} />
        <StatBox label="Parcelas" value={brl(totalParcelasFixo)} color="#34d399" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>} />
        <StatBox label="A Receber" value={brl(totalDevedores)} color="var(--red)" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M15 4a3 3 0 0 1 0 6M20 20c0-2.8-1.8-5.2-4.3-6.1"/></svg>} />
      </div>

      {/* ── Charts row ── */}
      {(pieData.length > 0 || data.saldos.length > 0) && (
        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Gráfico de pizza — categorias reais com acordeão */}
          {(() => {
            const faturas = data.faturas || { bancos: [], itens: {} };
            const todosItens = [
              ...data.gastoVar.map(i => ({ ...i, _fonte: "Gastos Variáveis" })),
              ...(faturas.bancos || []).flatMap(b =>
                (faturas.itens?.[b.id] || [])
                  .filter(i => i.mes === mesAtual || i.tipo === "FIXO")
                  .map(i => ({ ...i, _fonte: b.nome }))
              ),
            ];
            const porCat = {};
            const itensPorCat = {};
            todosItens.forEach(i => {
              const id = i.categoria || detectarCategoria(i.desc) || "outros";
              porCat[id] = (porCat[id] || 0) + (i.valor || 0);
              if (!itensPorCat[id]) itensPorCat[id] = [];
              itensPorCat[id].push(i);
            });
            const catData = Object.entries(porCat)
              .map(([id, value]) => { const c = getCat(id); return { id, name: c.label, value, color: c.cor, icon: c.icon }; })
              .filter(d => d.value > 0).sort((a, b) => b.value - a.value);
            if (catData.length === 0) return (
              <Card>
                <SectionHead icon={Icons.pieChart("currentColor")} title="Gastos por Categoria" />
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, marginTop: -10 }}>Divisão percentual de onde vai seu dinheiro este mês</div>
                <div className="empty-state" style={{ padding: "30px 0" }}>
                  <div className="empty-state-desc">Adicione lançamentos com categoria para ver o gráfico</div>
                </div>
              </Card>
            );
            const total = catData.reduce((a, b) => a + b.value, 0);
            return (
              <CatCard catData={catData} itensPorCat={itensPorCat} total={total} />
            );
          })()}

          {/* Gráfico de barras: entrada vs saída */}
          <Card>
            <SectionHead icon={Icons.barChart("currentColor")} title="Saldo vs Saídas" />
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, marginTop: -10 }}>🟢 Saldo em conta · 🔴 Total de saídas · 🟡 A receber de devedores</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[{ name: mesAtual, Saldo: totalSaldo, Saídas: totalSaidas, "A Receber": totalDevedores }]} barSize={28}>
                <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface3)" }} />
                <Bar dataKey="Saldo" fill="var(--accent)" radius={[4,4,0,0]} />
                <Bar dataKey="Saídas" fill="var(--red)" radius={[4,4,0,0]} />
                <Bar dataKey="A Receber" fill="var(--yellow)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ── Saldos + Devedores row ── */}
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <SectionHead icon={Icons.saldos} title="Saldos por Conta" />
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, marginTop: -10 }}>Saldo atual de cada conta ou carteira cadastrada</div>
          {data.saldos.length === 0 ? (
            <div className="empty-state" style={{ padding: "24px 0" }}>
              <div className="empty-state-desc">Nenhuma conta cadastrada</div>
            </div>
          ) : (
            <>
              {data.saldos.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🏦</div>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{s.conta}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: s.saldo > 0 ? "var(--accent)" : "var(--muted)", fontFamily: "var(--font-head)" }}>{brl(s.saldo)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border2)" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5 }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)", fontFamily: "var(--font-head)" }}>{brl(totalSaldo)}</span>
              </div>
            </>
          )}
        </Card>

        <Card>
          <SectionHead icon={Icons.devedores} title="A Receber" />
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, marginTop: -10 }}>Devedores com pagamento pendente agrupados por nome</div>
          {Object.keys(devedoresByName).length === 0 ? (
            <div className="empty-state" style={{ padding: "24px 0" }}>
              <div className="empty-state-icon" style={{ fontSize: 28 }}>✅</div>
              <div className="empty-state-desc">Nenhum devedor pendente</div>
            </div>
          ) : (
            <>
              {Object.entries(devedoresByName).map(([nome, val], i) => (
                <div key={nome} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: CHART_COLORS[i % CHART_COLORS.length] + "22", border: `1.5px solid ${CHART_COLORS[i % CHART_COLORS.length]}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: CHART_COLORS[i % CHART_COLORS.length], fontFamily: "var(--font-head)" }}>
                      {nome.substring(0, 2)}
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{nome}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--red)", fontFamily: "var(--font-head)" }}>{brl(val)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border2)" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5 }}>Total a receber</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--red)", fontFamily: "var(--font-head)" }}>{brl(totalDevedores)}</span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Progress bars ── */}
      <Card>
        <SectionHead icon={Icons.target("currentColor")} title="Distribuição de Gastos" />
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12, marginTop: -10 }}>Proporção de cada categoria em relação ao total de saídas do mês</div>
        {[
          { label: "Contas Fixas Mensais", val: totalContasFixas, color: "var(--blue)", max: Math.max(totalSaldo, totalSaidas, 1) },
          { label: "Parcelas Fixas", val: totalParcelasFixo, color: "var(--purple)", max: Math.max(totalSaldo, totalSaidas, 1) },
          { label: "Gastos Variáveis", val: totalGastoVar, color: "var(--yellow)", max: Math.max(totalSaldo, totalSaidas, 1) },
          { label: `Faturas (${mesAtual})`, val: totalFatura, color: "var(--accent)", max: Math.max(totalSaldo, totalSaidas, 1) },
        ].map(({ label, val, color, max }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--text2)" }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "var(--font-head)" }}>{brl(val)}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, (val / max) * 100)}%`, background: color }} />
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

  const toggleContaFixaPago = (id) => {
    const pagas = data.contaFixaPago || {};
    const jaEstaPago = !!pagas[id];
    setData({ ...data, contaFixaPago: { ...pagas, [id]: !jaEstaPago } });
    toast.success(jaEstaPago ? "Marcado como pendente" : "Conta paga! ✓");
  };

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
      toast.success("Item atualizado!");
      setModal(null); return;
    }
    if (modal === "gastoFixo") {
      if (!form.desc || !form.valor) return;
      setData({ ...data, gastoFixo: [...data.gastoFixo, { id: nextId(data.gastoFixo), desc: form.desc, situacao: form.situacao || "FIXO", parcela: form.parcela || "—", valor: parseFloat(form.valor) }] });
      toast.success("Parcela adicionada!");
    } else if (modal === "contaFixa") {
      if (!form.desc || !form.valor) return;
      setData({ ...data, contaFixa: [...data.contaFixa, { id: nextId(data.contaFixa), desc: form.desc, venc: form.venc || "—", valor: parseFloat(form.valor) }] });
      toast.success("Conta fixa adicionada!");
    } else if (modal === "gastoVar") {
      if (!form.desc || !form.valor) return;
      const catDetectada = form.categoria || detectarCategoria(form.desc);
      setData({ ...data, gastoVar: [...data.gastoVar, { id: nextId(data.gastoVar), desc: form.desc, data: form.data || "—", valor: parseFloat(form.valor), quem: form.quem || "PRÓPRIO", categoria: catDetectada }] });
      toast.success("Gasto variável adicionado!");
    }
    setModal(null);
  };

  const del = (section, id) => {
    const item = data[section].find(x => x.id === id);
    confirm({
      title: "Excluir item",
      message: `Deseja excluir "${item?.desc || "este item"}"?`,
      onConfirm: () => { setData({ ...data, [section]: data[section].filter(x => x.id !== id) }); toast.info("Item removido"); },
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
    <div className="form-group">
      <label className="form-label">{label}</label>
      {(key === "data") && type === "text"
        ? <input type="text" placeholder={placeholder || "DD/MM/AA"} value={form[key] || ""}
            onChange={e => setForm(f => ({ ...f, [key]: maskDate(e.target.value) }))} />
        : <input type={type} placeholder={placeholder} value={form[key] || ""}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
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
          {(section === "gastoVar") && (
            <>
              {inp("Descrição", "desc")}
              {form.desc && (() => {
                const auto = detectarCategoria(form.desc);
                const cat = getCat(form.categoria || auto);
                return (
                  <div className="form-group">
                    <label className="form-label">Categoria</label>
                    {cat && cat.id !== "outros" && !form._showCatPicker ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: cat.cor + "15", border: `1px solid ${cat.cor}33`, borderRadius: "var(--radius-sm)", marginBottom: 4 }}>
                        <span>{cat.icon}</span>
                        <span style={{ fontSize: 12, color: cat.cor, fontWeight: 600 }}>{auto && !form.categoria ? "Detectado: " : ""}{cat.label}</span>
                        <button onClick={() => setForm(f => ({ ...f, _showCatPicker: true }))} style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>Trocar</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                        {CATEGORIAS.map(c => (
                          <button key={c.id} onClick={() => setForm(f => ({ ...f, categoria: c.id, _showCatPicker: false }))}
                            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600,
                              background: (form.categoria || auto) === c.id ? c.cor + "25" : "var(--surface3)",
                              border: `1px solid ${(form.categoria || auto) === c.id ? c.cor : "var(--border)"}`,
                              color: (form.categoria || auto) === c.id ? c.cor : "var(--muted)" }}>
                            {c.icon} {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              {inp("Data", "data", "text", "DD/MM/AA")}
              {inp("Valor (R$)", "valor", "number", "0.00")}
              {inp("Quem Paga", "quem", "text", "PRÓPRIO")}
            </>
          )}
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
            { key: "situacao", label: "Situação", render: r => <Tag color={r._cor || "var(--accent4)"}>{r.situacao}</Tag> },
            { key: "parcela", label: "Parcela" },
            { key: "banco", label: "Cartão", render: r => r.banco ? <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.banco}</span> : null },
            { key: "valor", label: "Valor", right: true, render: r => brl(r.valor) },
          ]}
          rows={data.gastoFixo}
          onDelete={id => del("gastoFixo", id)}
          onEdit={row => openEdit("gastoFixo", row)}
          onReorder={newArr => reorder("gastoFixo", newArr)}
          onToggleHide={id => toggleHide("gastoFixo", id)}
          hiddenIds={getHiddenFor("gastoFixo")}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          {getHiddenFor("gastoFixo").length > 0 && <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{getHiddenFor("gastoFixo").length} oculto(s)</span>}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5 }}>Total</span>
            <span style={{ fontSize: 18, fontFamily: "var(--font-head)", fontWeight: 800, color: "var(--blue)" }}>{brl(sum(data.gastoFixo.filter(r => !getHiddenFor("gastoFixo").includes(r.id))))}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <SectionHead icon={Icons.receipt} title="Contas Fixas Mensais" color="var(--accent)" />
          <Btn small onClick={() => openAdd("contaFixa")}>+ Adicionar</Btn>
        </div>
        {/* Tabela de contas fixas com status pago/pendente */}
        <div style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", overflow: "hidden" }}>
          {data.contaFixa.length === 0 ? (
            <div className="empty-state" style={{ padding: "36px 20px" }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">Nenhuma conta fixa</div>
              <div className="empty-state-desc">Adicione suas contas mensais recorrentes</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "center" }}>Reserva</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.contaFixa.map(r => {
                  const pago = !!(data.contaFixaPago || {})[r.id];
                  return (
                    <tr key={r.id} style={{ opacity: pago ? 0.55 : 1 }}>
                      <td style={{ textDecoration: pago ? "line-through" : "none", color: pago ? "var(--muted)" : "var(--text)" }}>{r.desc}</td>
                      <td style={{ color: "var(--text2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.venc}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: pago ? "var(--muted)" : "var(--accent)", fontFamily: "var(--font-head)", textDecoration: pago ? "line-through" : "none" }}>{brl(r.valor)}</td>
                      <td style={{ textAlign: "center" }}>
                        <button onClick={() => toggleContaFixaPago(r.id)}
                          className="badge"
                          style={{ cursor: "pointer", background: pago ? "var(--green)18" : "var(--red)18", color: pago ? "var(--green)" : "var(--red)", border: `1px solid ${pago ? "var(--green)" : "var(--red)"}33` }}>
                          {pago ? "✓ PAGO" : "⏳ PEND"}
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {(() => {
                          const reservado = !!(data.contaFixaReserva || {})[r.id];
                          return (
                            <button onClick={() => {
                              setData({ ...data, contaFixaReserva: { ...(data.contaFixaReserva || {}), [r.id]: !reservado } });
                              toast.success(reservado ? "Reserva removida" : "🔒 Valor reservado!");
                            }} className="badge" style={{
                              cursor: "pointer",
                              background: reservado ? "var(--blue)18" : "var(--surface3)",
                              color: reservado ? "var(--blue)" : "var(--muted)",
                              border: `1px solid ${reservado ? "var(--blue)44" : "var(--border)"}`,
                            }}>
                              {reservado ? "🔒 RESERVADO" : "📌 RESERVAR"}
                            </button>
                          );
                        })()}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button onClick={() => openEdit("contaFixa", r)} style={{ background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", display: "flex", cursor: "pointer" }}>{Icons.edit()}</button>
                          <button onClick={() => del("contaFixa", r.id)} style={{ background: "var(--red)11", border: "1px solid var(--red)33", borderRadius: 6, padding: "5px 8px", display: "flex", cursor: "pointer" }}>{Icons.trash("var(--red)")}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {/* Progresso pagas/pendentes */}
        {data.contaFixa.length > 0 && (() => {
          const pagas = data.contaFixa.filter(r => !!(data.contaFixaPago || {})[r.id]);
          const total = data.contaFixa.length;
          return (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(pagas.length / total) * 100}%`, background: "var(--green)" }} />
                </div>
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{pagas.length}/{total} pagas</span>
            </div>
          );
        })()}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          {getHiddenFor("contaFixa").length > 0 && <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{getHiddenFor("contaFixa").length} oculto(s)</span>}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5 }}>Total</span>
            <span style={{ fontSize: 18, fontFamily: "var(--font-head)", fontWeight: 800, color: "var(--accent)" }}>{brl(sum(data.contaFixa.filter(r => !getHiddenFor("contaFixa").includes(r.id))))}</span>
          </div>
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
            { key: "desc", label: "Descrição", render: r => (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {r.categoria && (() => { const c = getCat(r.categoria); return <span title={c.label}>{c.icon}</span>; })()}
                <span>{r.desc}</span>
              </div>
            )},
            { key: "categoria", label: "Categoria", render: r => {
              const c = r.categoria ? getCat(r.categoria) : null;
              return c && c.id !== "outros" ? <Tag color={c.cor}>{c.label}</Tag> : <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>;
            }},
            { key: "data", label: "Data" },
            { key: "valor", label: "Valor", right: true, render: r => brl(r.valor) },
          ]}
          rows={data.gastoVar}
          onDelete={id => del("gastoVar", id)}
          onEdit={row => openEdit("gastoVar", row)}
          onReorder={newArr => reorder("gastoVar", newArr)}
          onToggleHide={id => toggleHide("gastoVar", id)}
          hiddenIds={getHiddenFor("gastoVar")}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          {getHiddenFor("gastoVar").length > 0 && <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{getHiddenFor("gastoVar").length} oculto(s)</span>}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5 }}>Total</span>
            <span style={{ fontSize: 18, fontFamily: "var(--font-head)", fontWeight: 800, color: "var(--yellow)" }}>{brl(sum(data.gastoVar.filter(r => !getHiddenFor("gastoVar").includes(r.id))))}</span>
          </div>
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
      toast.success("Conta atualizada!");
    } else {
      setData({ ...data, saldos: [...data.saldos, { id: nextId(data.saldos), conta: form.conta, saldo: parseFloat(form.saldo) || 0, obs: form.obs || "" }] });
      toast.success("Conta adicionada!");
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
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input type={type} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
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
        {data.saldos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <div className="empty-state-title">Nenhuma conta ainda</div>
            <div className="empty-state-desc">Adicione suas contas bancárias, carteiras ou reservas</div>
          </div>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 20 }}>
          {data.saldos.map(s => {
            const cor = s.saldo > 5000 ? "var(--accent)" : s.saldo > 1000 ? "var(--blue)" : s.saldo > 0 ? "var(--yellow)" : "var(--muted)";
            return (
            <div key={s.id} className="card-hover" style={{ background: "var(--surface2)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "18px 20px", position: "relative", borderLeft: `3px solid ${cor}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: cor + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🏦</div>
                <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 500 }}>{s.conta}</span>
              </div>
              <div style={{ fontSize: 26, fontFamily: "var(--font-head)", fontWeight: 800, color: cor, letterSpacing: -0.5 }}>{brl(s.saldo)}</div>
              {s.obs && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{s.obs}</div>}
              <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 4 }}>
                <button onClick={() => openEdit(s)} style={{ background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 7px", display: "flex", alignItems: "center", cursor: "pointer" }}>{Icons.edit()}</button>
                <button onClick={() => del(s)} style={{ background: "var(--red)11", border: "1px solid var(--red)33", borderRadius: 6, padding: "4px 7px", display: "flex", alignItems: "center", cursor: "pointer" }}>{Icons.trash("var(--red)")}</button>
              </div>
            </div>
            );
          })}
        </div>
        )}
        <div style={{ background: "var(--surface3)", border: "1.5px solid var(--accent)22", borderRadius: "var(--radius-sm)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, fontFamily: "var(--font-mono)" }}>Total Geral</div>
            <div style={{ fontSize: 28, fontFamily: "var(--font-head)", fontWeight: 900, color: "var(--accent)", letterSpacing: -0.5 }}>{brl(total)}</div>
          </div>
          <div style={{ fontSize: 32, opacity: 0.3 }}>💰</div>
        </div>
      </Card>
    </div>
  );
}

// ─── TAB: Devedores ───────────────────────────────────────────────────────────
function Devedores({ data, setData }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [editObs, setEditObs] = useState(null);
  const [obsText, setObsText] = useState("");
  const [confirm, confirmDialog] = useConfirm();
  const [parcelasOpen, setParcelasOpen] = useState({}); // { devedorId: true/false }

  // Pegar todas as parcelas de um devedor pelo faturaItemId
  const getParcelasDev = (devedor) => {
    if (!devedor.faturabancoId) return [];
    const faturas = data.faturas || { bancos: [], itens: {} };
    const itensBanco = faturas.itens?.[devedor.faturabancoId] || [];
    // Encontra o item original pelo faturaItemId
    const itemOriginal = itensBanco.find(i => i.id === devedor.faturaItemId);
    if (!itemOriginal) return [];
    // Se for PARCELA, busca todas do mesmo grupo (mesma desc base)
    if (itemOriginal.tipo === "PARCELA") {
      const descBase = itemOriginal.desc.replace(/\s*\(\d+\/\d+\)/, "").trim();
      return itensBanco
        .filter(i => i.tipo === "PARCELA" && i.desc.replace(/\s*\(\d+\/\d+\)/, "").trim() === descBase)
        .sort((a, b) => {
          const nA = parseInt(a.desc.match(/\((\d+)\//)?.[1] || 0);
          const nB = parseInt(b.desc.match(/\((\d+)\//)?.[1] || 0);
          return nA - nB;
        });
    }
    return [];
  };

  const toggleParcelaPaga = (devedorId, parcelaId) => {
    const key = `${devedorId}:${parcelaId}`;
    const pagas = data.parcelasPagas || {};
    const novas = { ...pagas, [key]: !pagas[key] };
    setData({ ...data, parcelasPagas: novas });
  };

  const isParcelaPaga = (devedorId, parcelaId) => {
    return !!(data.parcelasPagas || {})[`${devedorId}:${parcelaId}`];
  };

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
    onConfirm: () => {
      const novasParcelasPagas = Object.fromEntries(
        Object.entries(data.parcelasPagas || {}).filter(([key]) => !key.startsWith(`${row.id}:`))
      );
      setData({ ...data, devedores: data.devedores.filter(d => d.id !== row.id), parcelasPagas: novasParcelasPagas });
      toast.info("Devedor removido");
    },
  });

  const byName = data.devedores.reduce((acc, d) => {
    if (!acc[d.nome]) acc[d.nome] = [];
    acc[d.nome].push(d);
    return acc;
  }, {});

  const inp = (label, key, type = "text", ph = "") => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input type={type} placeholder={ph} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
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
        const getStatusEfetivo = (r) => {
          const parcelas = getParcelasDev(r);
          if (parcelas.length === 0) return r.status;
          const pagasCount = parcelas.filter(p => isParcelaPaga(r.id, p.id)).length;
          return (pagasCount > 0 && pagasCount === parcelas.length) ? "PAGO" : "PENDENTE";
        };
        const totalPend = sum(items.filter(i => getStatusEfetivo(i) !== "PAGO"));
        const totalPago = sum(items.filter(i => getStatusEfetivo(i) === "PAGO"));
        const todasQuitadas = items.length > 0 && items.every(i => getStatusEfetivo(i) === "PAGO");
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
                <div style={{ fontSize: 11, color: todasQuitadas ? "var(--accent)" : "var(--muted)" }}>
                  {todasQuitadas ? "✅ Quitado" : "Pendente"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: todasQuitadas ? "var(--accent)" : color }}>
                  {todasQuitadas ? brl(totalPago) : brl(totalPend)}
                </div>
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
                    {/* Acordeão de parcelas */}
                    {(() => {
                      const parcelas = getParcelasDev(r);
                      if (parcelas.length === 0) return null;
                      const pagas = parcelas.filter(p => isParcelaPaga(r.id, p.id)).length;
                      const total = parcelas.length;
                      const isOpen = parcelasOpen[r.id];
                      return (
                        <div style={{ marginTop: 8 }}>
                          {/* Toggle button */}
                          <button
                            onClick={() => setParcelasOpen(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              background: "var(--surface3)", border: "1px solid var(--border2)",
                              borderRadius: 6, padding: "4px 10px", fontSize: 11,
                              color: "var(--text2)", cursor: "pointer", fontFamily: "var(--font-body)",
                              fontWeight: 600, transition: "all .15s",
                            }}
                          >
                            <span style={{ fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                            📦 {pagas}/{total} parcelas pagas
                            <div style={{
                              width: 48, height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden",
                            }}>
                              <div style={{ width: `${(pagas/total)*100}%`, height: "100%", background: pagas === total ? "var(--accent)" : color, borderRadius: 99, transition: "width .3s" }} />
                            </div>
                          </button>

                          {/* Parcelas expandidas */}
                          {isOpen && (
                            <div style={{
                              marginTop: 8, background: "var(--surface3)",
                              border: "1px solid var(--border)", borderRadius: 8,
                              overflow: "hidden",
                            }}>
                              {/* Header */}
                              <div style={{
                                display: "grid", gridTemplateColumns: "1fr 80px 70px 60px",
                                padding: "7px 12px", borderBottom: "1px solid var(--border)",
                                fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)",
                                textTransform: "uppercase", letterSpacing: 0.5, background: "var(--surface2)",
                              }}>
                                <span>Parcela</span>
                                <span>Mês</span>
                                <span style={{ textAlign: "right" }}>Valor</span>
                                <span style={{ textAlign: "center" }}>Pago</span>
                              </div>
                              {parcelas.map((p, idx) => {
                                const paga = isParcelaPaga(r.id, p.id);
                                const numMatch = p.desc.match(/\((\d+)\/(\d+)\)/);
                                const numParcela = numMatch ? `${numMatch[1]}/${numMatch[2]}` : `${idx+1}`;
                                const isUltima = numMatch && numMatch[1] === numMatch[2];
                                return (
                                  <div key={p.id} style={{
                                    display: "grid", gridTemplateColumns: "1fr 80px 70px 60px",
                                    padding: "9px 12px", borderBottom: idx < parcelas.length - 1 ? "1px solid var(--border)" : "none",
                                    alignItems: "center",
                                    background: paga ? "var(--accent)08" : "transparent",
                                    transition: "background .15s",
                                  }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 12, color: paga ? "var(--muted)" : "var(--text)", textDecoration: paga ? "line-through" : "none", fontFamily: "var(--font-mono)" }}>
                                        #{numParcela}
                                      </span>
                                      {isUltima && <span className="badge" style={{ background: "var(--red)15", color: "var(--red)", border: "1px solid var(--red)33", fontSize: 9 }}>ÚLTIMA</span>}
                                      {paga && <span className="badge" style={{ background: "var(--accent)15", color: "var(--accent)", border: "1px solid var(--accent)33", fontSize: 9 }}>✓</span>}
                                    </div>
                                    <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{p.mes}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, textAlign: "right", color: paga ? "var(--muted)" : color, fontFamily: "var(--font-head)", textDecoration: paga ? "line-through" : "none" }}>{brl(p.valor)}</span>
                                    <div style={{ display: "flex", justifyContent: "center" }}>
                                      <button
                                        onClick={() => toggleParcelaPaga(r.id, p.id)}
                                        style={{
                                          width: 22, height: 22, borderRadius: 6,
                                          background: paga ? "var(--accent)22" : "var(--surface2)",
                                          border: `1.5px solid ${paga ? "var(--accent)" : "var(--border2)"}`,
                                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                          fontSize: 11, color: paga ? "var(--accent)" : "var(--muted)",
                                          transition: "all .15s",
                                        }}
                                      >
                                        {paga ? "✓" : ""}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Resumo */}
                              <div style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "8px 12px", background: "var(--surface2)",
                                borderTop: "1px solid var(--border)",
                                fontSize: 11, fontFamily: "var(--font-mono)",
                              }}>
                                <span style={{ color: "var(--muted)" }}>
                                  {total - pagas} restante(s) · {brl((total - pagas) * r.valor)}
                                </span>
                                <span style={{ color: pagas === total ? "var(--accent)" : color, fontWeight: 700 }}>
                                  {pagas === total ? "✓ Quitado!" : `${pagas}/${total} pagas`}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Valor + ações */}
                  {(() => {
                    const parcelas = getParcelasDev(r);
                    const temParcelas = parcelas.length > 0;
                    const pagasCount = parcelas.filter(p => isParcelaPaga(r.id, p.id)).length;
                    const todasQuitadas = temParcelas && pagasCount > 0 && pagasCount === parcelas.length;
                    const statusEfetivo = temParcelas ? (todasQuitadas ? "PAGO" : "PENDENTE") : r.status;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: statusEfetivo === "PAGO" ? "var(--muted)" : color, textDecoration: statusEfetivo === "PAGO" ? "line-through" : "none" }}>
                          {brl(r.valor)}
                        </span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {temParcelas ? (
                            <span className="badge" style={{
                              border: `1px solid ${todasQuitadas ? "var(--accent)44" : "var(--red)44"}`,
                              background: todasQuitadas ? "var(--accent)15" : "var(--red)15",
                              color: todasQuitadas ? "var(--accent)" : "var(--red)",
                              padding: "4px 10px",
                            }}>
                              {todasQuitadas ? "✅ QUITADO" : "⏳ PEND"}
                            </span>
                          ) : (
                            <button onClick={() => { toggleStatus(r.id); toast.success(r.status === "PAGO" ? "Marcado como pendente" : "Marcado como pago! ✓"); }}
                              className="badge" style={{ cursor: "pointer", border: `1px solid ${r.status === "PAGO" ? "var(--accent)44" : "var(--red)44"}`, background: r.status === "PAGO" ? "var(--accent)15" : "var(--red)15", color: r.status === "PAGO" ? "var(--accent)" : "var(--red)", padding: "4px 10px" }}
                            >
                              {r.status === "PAGO" ? "✓ PAGO" : "⏳ PEND"}
                            </button>
                          )}
                          <button onClick={() => del(r)} style={{ background: "#ff6b6b11", border: "1px solid #ff6b6b33", borderRadius: 4, padding: "2px 6px", display: "flex", alignItems: "center", cursor: "pointer" }}>
                            {Icons.trash()}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
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

// Gera meses dinamicamente: 6 meses atrás + mês atual + 18 meses à frente
// Assim o array sempre se expande conforme o tempo passa
const gerarMeses = () => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const labels = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const meses = [];
  // Começa sempre de JAN/26 (mês inicial do app) até 30 meses à frente do mês atual
  // Isso garante que parcelas longas apareçam todas
  const inicio = new Date(2026, 0, 1); // JAN/26 fixo como início
  const fim = new Date(now.getFullYear(), now.getMonth() + 30, 1); // 30 meses no futuro
  let cur = new Date(inicio);
  while (cur <= fim) {
    const label = `${labels[cur.getMonth()]}/${String(cur.getFullYear()).slice(2)}`;
    meses.push(label);
    cur.setMonth(cur.getMonth() + 1);
  }
  return meses;
};
const MESES = gerarMeses();

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
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {r.categoria && (() => { const c = getCat(r.categoria); return <span title={c.label}>{c.icon}</span>; })()}
                <span>{r.desc}</span>
                {r.tipo === "FIXO" && <span style={{ fontSize: 10, background: "var(--accent)22", color: "var(--accent)", border: "1px solid var(--accent)44", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>TODOS OS MESES</span>}
                {r.tipo === "PARCELA" && isLastParcela(r.desc) && (
                  <span style={{ fontSize: 10, background: "#ff6b6b22", color: "#ff6b6b", border: "1px solid #ff6b6b44", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>ÚLTIMA ✓</span>
                )}
              </div>
            )},
            { key: "tipo", label: "Tipo", render: r => <Tag color={tipoColor[r.tipo] || "var(--muted)"}>{r.tipo}</Tag> },
            { key: "categoria", label: "Cat.", render: r => {
              const c = r.categoria ? getCat(r.categoria) : null;
              return c && c.id !== "outros" ? <Tag color={c.cor}>{c.label}</Tag> : null;
            }},
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
  const [modalMesesAntigos, setModalMesesAntigos] = useState(false);
  const [modalMesesProximos, setModalMesesProximos] = useState(false);
  const [modalBancoFiltro, setModalBancoFiltro] = useState(null);
  const [modalBancoFiltroProx, setModalBancoFiltroProx] = useState(null); // banco selecionado no modal de meses antigos
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
        ? `A fatura de ${mes} será fechada. O próximo mês (${proximoMes}) será aberto com os lançamentos FIXOS. Continuar?`
        : `A fatura de ${mes} será marcada como fechada. É o último mês disponível.`,
      onConfirm: () => {
        // ── 1. Marcar mês atual como fechado ──────────────────────────
        const novasFechadas = { ...fechadas, [faturaKey]: true };

        // ── 2. Montar todos os itens visíveis neste mês ───────────────
        const fixosGlobais = itemsBanco.filter(i => i.tipo === "FIXO");
        const mesItens = itemsBanco.filter(i => i.mes === mes);
        const todosItens = [...fixosGlobais, ...mesItens]
          .filter((x, idx, arr) => arr.findIndex(y => y.id === x.id) === idx);

        // ── 3. Marcar parcela do mês fechado como paga no parcelasPagas ──
        const novosDevedores = [...data.devedores];
        let novasParcelasPagas = { ...(data.parcelasPagas || {}) };
        const todosBancoItens = data.faturas?.itens?.[bancoSel] || [];

        // Para cada item do mês sendo fechado
        todosItens.forEach(item => {
          const descBase = item.desc.replace(/\s*\(\d+\/\d+\)/, "").trim();

          // Encontra o devedor dono deste grupo (pode ter faturaItemId de qualquer parcela)
          const devedor = novosDevedores.find(d => {
            if (d.faturabancoId !== bancoSel) return false;
            const itemRef = todosBancoItens.find(i => i.id === d.faturaItemId);
            if (!itemRef) return false;
            return itemRef.desc.replace(/\s*\(\d+\/\d+\)/, "").trim() === descBase;
          });
          if (!devedor) return;

          // Marca TODAS as parcelas até o mês fechado como pagas
          // (não só a do mês atual — garante consistência ao fechar meses fora de ordem)
          const idxMesFechado = MESES.indexOf(mes);
          todosBancoItens
            .filter(i => {
              if (i.desc.replace(/\s*\(\d+\/\d+\)/, "").trim() !== descBase) return false;
              if (i.tipo !== "PARCELA" && i.tipo !== "FIXO") return false;
              // Inclui parcelas até o mês fechado
              return MESES.indexOf(i.mes) <= idxMesFechado || i.mes === mes;
            })
            .forEach(parcela => {
              novasParcelasPagas[`${devedor.id}:${parcela.id}`] = true;
            });
        });

        setData({
          ...data,
          devedores: novosDevedores,
          parcelasPagas: novasParcelasPagas,
          faturas: { ...faturas, fechadas: novasFechadas },
        });
        toast.success(`Fatura ${bancoAtual.nome} – ${mes} fechada!`);
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
        newEntries.push({ id: baseId++, mes: MESES[mesIdx], desc: `${form.desc} (${p}/${totalParcelas})`, tipo: "PARCELA", data: dataRef, valor, categoria: form.categoria || detectarCategoria(form.desc), isDevedor: !!form.isDevedor });
      }
    } else {
      newEntries.push({ id: baseId, mes: tipo === "FIXO" ? "FIXO" : mes, desc: form.desc, tipo, data: dataRef, valor, categoria: form.categoria || detectarCategoria(form.desc), isDevedor: !!form.isDevedor });
    }

    let newData = { ...data };

    // ── Devedor via toggle no modal ──
    if (form.isDevedor && form.devedorNome?.trim()) {
      const nomeDevedor = form.devedorNome.trim().toUpperCase();
      const valorDevedor = form.devedorTipo === "parcial" ? (parseFloat(form.devedorValorParcial) || valor) : valor;
      const itemId = newEntries[0]?.id ?? baseId;
      const novoDevedor = {
        id: nextId(newData.devedores),
        nome: nomeDevedor,
        desc: form.desc,
        valor: valorDevedor,
        prazo: bancoAtual?.vencimento || "—",
        status: "PENDENTE",
        obs: "",
        faturaItemId: itemId,
        faturabancoId: bancoSel,
      };
      newData = { ...newData, devedores: [...newData.devedores, novoDevedor] };
    } else {
      // Só espelha em Gastos se não for devedor
      if (tipo === "VARIÁVEL") {
        const novoVar = {
          id: nextId(newData.gastoVar),
          desc: form.desc,
          data: dataRef !== "—" ? dataRef : "—",
          valor,
          quem: "PRÓPRIO",
          banco: bancoAtual?.nome || "—",
          _faturaItemId: newEntries[0]?.id,
          _cor: bancoAtual?.cor,
        };
        newData = { ...newData, gastoVar: [...newData.gastoVar, novoVar] };
      } else {
        // Para PARCELA: só adiciona a primeira (mês atual), não todas as 10
        const entryParaGasto = tipo === "PARCELA" ? [newEntries[0]] : newEntries;
        const novosGastos = entryParaGasto.map((entry, i) => ({
          id: nextId([...newData.gastoFixo]) + i,
          desc: tipo === "PARCELA" ? form.desc : entry.desc, // descrição sem "(1/10)"
          situacao: tipo,
          parcela: tipo === "PARCELA" ? (entry.desc.match(/\((\d+\/\d+)\)/)?.[1] || "—") : "—",
          valor,
          banco: bancoAtual?.nome || "—",
          _faturaItemId: entry.id,
          _cor: bancoAtual?.cor || "var(--accent4)",
          categoria: entry.categoria,
        }));
        newData = { ...newData, gastoFixo: [...newData.gastoFixo, ...novosGastos] };
      }
    }

    const updatedItens = { ...itens, [bancoSel]: [...itemsBanco, ...newEntries] };
    setData({ ...newData, faturas: { ...faturas, itens: updatedItens } });
    toast.success(tipo === "PARCELA" ? "Parcelas criadas!" : "Lançamento adicionado!");
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
    const isParcela = item?.tipo === "PARCELA";
    const descBase = isParcela ? item.desc.replace(/\s*\(\d+\/\d+\)/, "").trim() : null;
    const grupoIds = isParcela
      ? itemsBanco.filter(i => i.tipo === "PARCELA" && i.desc.replace(/\s*\(\d+\/\d+\)/, "").trim() === descBase).map(i => i.id)
      : [id];
    confirm({
      title: "Excluir lançamento",
      message: isParcela
        ? "Tem certeza que deseja excluir essa parcela? Isso vai apagar em todos os meses futuros."
        : `Deseja excluir "${item?.desc || "este lançamento"}"?`,
      onConfirm: () => {
        const updatedItens = { ...itens, [bancoSel]: itemsBanco.filter(i => !grupoIds.includes(i.id)) };
        let updatedDevedores = data.devedores;
        if (item) {
          updatedDevedores = data.devedores.filter(d =>
            !(d.faturaItemId === item.id && d.faturabancoId === bancoSel && d.status === "PENDENTE")
          );
        }
        setData({ ...data, devedores: updatedDevedores, faturas: { ...faturas, itens: updatedItens } });
        toast.info(isParcela ? `${grupoIds.length} parcelas excluídas` : "Lançamento excluído");
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
    <div className="form-group">
      <label className="form-label">{label}</label>
      {key === "data" && type === "text"
        ? <input type="text" placeholder={ph || "DD/MM/AA"} value={form[key] || ""}
            onChange={e => setForm(f => ({ ...f, [key]: maskDate(e.target.value) }))} />
        : <input type={type} placeholder={ph} value={form[key] || ""}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
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

      {/* ── Modal meses anteriores ── */}
      {modalMesesAntigos && (() => {
        const bancoFiltro = bancos.find(b => b.id === modalBancoFiltro) || bancos[0] || null;
        const idxAtual = MESES.indexOf(mesAtual);
        const mesesPassados = MESES.slice(0, idxAtual).reverse();
        return (
          <Modal title="🗂 Meses Anteriores" onClose={() => { setModalMesesAntigos(false); setModalBancoFiltro(null); }} size="lg">
            {/* Seletor de banco */}
            {bancos.length > 1 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {bancos.map(b => (
                  <button key={b.id} onClick={() => setModalBancoFiltro(b.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                      background: (modalBancoFiltro || bancos[0]?.id) === b.id ? b.cor + "22" : "var(--surface3)",
                      border: `1.5px solid ${(modalBancoFiltro || bancos[0]?.id) === b.id ? b.cor : "var(--border)"}`,
                      color: (modalBancoFiltro || bancos[0]?.id) === b.id ? b.cor : "var(--muted)",
                      fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13,
                      transition: "all .15s",
                    }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.cor }} />
                    {b.nome}
                  </button>
                ))}
              </div>
            )}

            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              {bancoFiltro ? `Faturas anteriores — ${bancoFiltro.nome}` : "Selecione um banco acima"}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
              {!bancoFiltro ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>Nenhum banco cadastrado</div>
              ) : mesesPassados.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>Nenhum mês anterior disponível</div>
              ) : mesesPassados.map(m => {
                const bItens = itens[bancoFiltro.id] || [];
                const fixos = bItens.filter(i => i.tipo === "FIXO");
                const mesItens = bItens.filter(i => i.mes === m && i.tipo !== "FIXO");
                const total = sum([...fixos, ...mesItens]);
                const fechada = fechadas[`${bancoFiltro.id}:${m}`];
                const cor = bancoFiltro.cor;
                // Só mostrar meses que têm lançamentos OU que estão fechados
                if (total === 0 && !fechada) return null;
                return (
                  <div key={m}
                    onClick={() => { setBancoSel(bancoFiltro.id); setMes(m); setModalMesesAntigos(false); setModalBancoFiltro(null); }}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      background: "var(--surface3)", border: `1px solid ${fechada ? cor + "33" : "var(--border)"}`,
                      borderLeft: `3px solid ${fechada ? cor : "var(--border2)"}`,
                      borderRadius: 8, padding: "12px 14px", cursor: "pointer", transition: "all .15s",
                    }}
                    onMouseOver={e => e.currentTarget.style.background = cor + "0d"}
                    onMouseOut={e => e.currentTarget.style.background = "var(--surface3)"}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 14 }}>{m}</span>
                        {fechada
                          ? <span className="badge" style={{ background: "var(--accent)15", color: "var(--accent)", border: "1px solid var(--accent)33" }}>✅ FECHADA</span>
                          : <span className="badge" style={{ background: "var(--yellow)15", color: "var(--yellow)", border: "1px solid var(--yellow)33" }}>⚡ ABERTA</span>
                        }
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{mesItens.length + fixos.length} lançamento(s)</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 18, color: cor }}>{brl(total)}</div>
                      <div style={{ fontSize: 10, color: "var(--accent4)", marginTop: 2 }}>→ abrir</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Modal>
        );
      })()}

      {/* ── Modal próximos meses ── */}
      {modalMesesProximos && (() => {
        const bancoFiltro = bancos.find(b => b.id === modalBancoFiltroProx) || bancos[0] || null;
        const idxAtual = MESES.indexOf(mesAtual);
        const mesesProximos = MESES.slice(idxAtual + 4);
        return (
          <Modal title="🔮 Próximos Meses" onClose={() => { setModalMesesProximos(false); setModalBancoFiltroProx(null); }} size="lg">
            {bancos.length > 1 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {bancos.map(b => (
                  <button key={b.id} onClick={() => setModalBancoFiltroProx(b.id)} style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                    background: (modalBancoFiltroProx || bancos[0]?.id) === b.id ? b.cor + "22" : "var(--surface3)",
                    border: `1.5px solid ${(modalBancoFiltroProx || bancos[0]?.id) === b.id ? b.cor : "var(--border)"}`,
                    color: (modalBancoFiltroProx || bancos[0]?.id) === b.id ? b.cor : "var(--muted)",
                    fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 13, transition: "all .15s",
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.cor }} />
                    {b.nome}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              {bancoFiltro ? `Faturas futuras — ${bancoFiltro.nome}` : "Selecione um banco acima"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
              {!bancoFiltro ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>Nenhum banco cadastrado</div>
              ) : mesesProximos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>Nenhum mês futuro disponível</div>
              ) : mesesProximos.map(m => {
                const bItens = itens[bancoFiltro.id] || [];
                const fixos = bItens.filter(i => i.tipo === "FIXO");
                const mesItens = bItens.filter(i => i.mes === m && i.tipo !== "FIXO");
                const total = sum([...fixos, ...mesItens]);
                const fechada = fechadas[`${bancoFiltro.id}:${m}`];
                const cor = bancoFiltro.cor;
                if (total === 0 && !fechada) return null;
                return (
                  <div key={m} onClick={() => { setBancoSel(bancoFiltro.id); setMes(m); setModalMesesProximos(false); setModalBancoFiltroProx(null); }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface3)", border: `1px solid ${cor + "33"}`, borderLeft: `3px solid ${cor}`, borderRadius: 8, padding: "12px 14px", cursor: "pointer", transition: "all .15s" }}
                    onMouseOver={e => e.currentTarget.style.background = cor + "0d"}
                    onMouseOut={e => e.currentTarget.style.background = "var(--surface3)"}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 14 }}>{m}</span>
                        {fechada
                          ? <span className="badge" style={{ background: "var(--accent)15", color: "var(--accent)", border: "1px solid var(--accent)33" }}>✅ FECHADA</span>
                          : <span className="badge" style={{ background: "var(--purple)15", color: "var(--purple)", border: "1px solid var(--purple)33" }}>🔮 FUTURA</span>
                        }
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{mesItens.length + fixos.length} lançamento(s)</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 18, color: cor }}>{brl(total)}</div>
                      <div style={{ fontSize: 10, color: "var(--accent4)", marginTop: 2 }}>→ abrir</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Modal>
        );
      })()}

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

          {/* ── Toggle devedor ── */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => setForm(f => ({ ...f, isDevedor: !f.isDevedor, devedorTipo: f.devedorTipo || "integral" }))}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                background: form.isDevedor ? bancoAtual.cor + "15" : "var(--surface3)",
                border: `1px solid ${form.isDevedor ? bancoAtual.cor + "55" : "var(--border)"}`,
                borderRadius: 8, padding: "10px 14px", cursor: "pointer", transition: "all .15s",
              }}
            >
              <div style={{
                width: 36, height: 20, borderRadius: 10, transition: "all .2s",
                background: form.isDevedor ? bancoAtual.cor : "var(--border2)",
                position: "relative", flexShrink: 0,
              }}>
                <div style={{
                  position: "absolute", top: 2, left: form.isDevedor ? 18 : 2,
                  width: 16, height: 16, borderRadius: "50%", background: "white",
                  transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: form.isDevedor ? bancoAtual.cor : "var(--muted)" }}>
                👤 Esta compra é de um devedor
              </span>
            </button>
          </div>

          {form.isDevedor && (
            <div style={{ background: "var(--surface)", border: `1px solid ${bancoAtual.cor}33`, borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: bancoAtual.cor, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>👤 Dados do Devedor</div>

              {/* Nome com autocomplete */}
              <div style={{ marginBottom: 10, position: "relative" }}>
                <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Nome</label>
                <input
                  type="text"
                  placeholder="Ex: João, Maria..."
                  value={form.devedorNome || ""}
                  onChange={e => setForm(f => ({ ...f, devedorNome: e.target.value }))}
                  style={{ width: "100%" }}
                  autoComplete="off"
                />
                {/* Sugestões de autocomplete */}
                {(() => {
                  const digitado = (form.devedorNome || "").trim().toLowerCase();
                  if (!digitado) return null;
                  const nomesExistentes = [...new Set(data.devedores.map(d => d.nome))];
                  const sugestoes = nomesExistentes.filter(n => n.toLowerCase().includes(digitado) && n.toLowerCase() !== digitado);
                  if (!sugestoes.length) return null;
                  return (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: "0 0 8px 8px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,.2)",
                    }}>
                      {sugestoes.map(nome => (
                        <button key={nome} onClick={() => setForm(f => ({ ...f, devedorNome: nome }))}
                          style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "9px 14px", background: "transparent", border: "none",
                            borderBottom: "1px solid var(--border)", cursor: "pointer",
                            fontSize: 13, color: "var(--text)", fontFamily: "var(--font-body)",
                          }}
                          onMouseOver={e => e.currentTarget.style.background = bancoAtual.cor + "15"}
                          onMouseOut={e => e.currentTarget.style.background = "transparent"}
                        >
                          👤 {nome}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Integral / Parcial */}
              <div style={{ marginBottom: form.devedorTipo === "parcial" ? 10 : 0 }}>
                <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Tipo de Pagamento</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["integral", "parcial"].map(opt => (
                    <button key={opt} onClick={() => setForm(f => ({ ...f, devedorTipo: opt }))}
                      style={{
                        flex: 1, padding: "8px 0", borderRadius: 7, cursor: "pointer",
                        fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 12,
                        textTransform: "uppercase", letterSpacing: 0.5, transition: "all .15s",
                        background: form.devedorTipo === opt ? bancoAtual.cor + "22" : "var(--surface3)",
                        border: `1.5px solid ${form.devedorTipo === opt ? bancoAtual.cor : "var(--border)"}`,
                        color: form.devedorTipo === opt ? bancoAtual.cor : "var(--muted)",
                      }}
                    >
                      {opt === "integral" ? "💯 Integral" : "✂️ Parcial"}
                    </button>
                  ))}
                </div>
              </div>

              {form.devedorTipo === "parcial" && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Valor que o devedor paga por mês (R$)</label>
                  <input
                    type="number"
                    placeholder="Ex: 50.00"
                    value={form.devedorValorParcial || ""}
                    onChange={e => setForm(f => ({ ...f, devedorValorParcial: e.target.value }))}
                    style={{ width: "100%" }}
                  />
                  {form.devedorValorParcial && form.valor && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
                      Devedor paga <strong style={{ color: bancoAtual.cor }}>{brl(parseFloat(form.devedorValorParcial) || 0)}</strong> dos <strong>{brl(parseFloat(form.valor) || 0)}</strong> por mês
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Categoria */}
          {form.desc && (() => {
            const auto = detectarCategoria(form.desc);
            const cat = getCat(form.categoria || auto);
            return (
              <div className="form-group">
                <label className="form-label">Categoria</label>
                {cat && cat.id !== "outros" && !form._showCatPicker ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: cat.cor + "15", border: `1px solid ${cat.cor}33`, borderRadius: "var(--radius-sm)" }}>
                    <span>{cat.icon}</span>
                    <span style={{ fontSize: 12, color: cat.cor, fontWeight: 600 }}>{auto && !form.categoria ? "Detectado: " : ""}{cat.label}</span>
                    <button onClick={() => setForm(f => ({ ...f, _showCatPicker: true }))} style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>Trocar</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {CATEGORIAS.map(c => (
                      <button key={c.id} onClick={() => setForm(f => ({ ...f, categoria: c.id, _showCatPicker: false }))}
                        style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600,
                          background: (form.categoria || auto) === c.id ? c.cor + "25" : "var(--surface3)",
                          border: `1px solid ${(form.categoria || auto) === c.id ? c.cor : "var(--border)"}`,
                          color: (form.categoria || auto) === c.id ? c.cor : "var(--muted)" }}>
                        {c.icon} {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

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

        </div>

        {/* Meses — botão anteriores | atual + 3 | botão próximos */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setModalMesesAntigos(true)} style={{
            background: "var(--surface3)", border: "1px solid var(--border)",
            color: "var(--muted)", borderRadius: 6, padding: "6px 12px",
            fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            🗂 Meses anteriores
          </button>
          {(() => {
            const idxAtual = MESES.indexOf(mesAtual);
            return MESES.slice(idxAtual, idxAtual + 4).map(m => {
              const fechada = fechadas[`${bancoSel}:${m}`];
              return (
                <button key={m} onClick={() => setMes(m)} style={{
                  background: mes === m ? (bancoAtual?.cor || "var(--accent)") + "22" : "var(--surface)",
                  border: `1px solid ${mes === m ? (bancoAtual?.cor || "var(--accent)") + "66" : "var(--border)"}`,
                  color: mes === m ? (bancoAtual?.cor || "var(--accent)") : "var(--text2)",
                  borderRadius: 6, padding: "6px 12px", fontFamily: "var(--font-mono)", fontSize: 12,
                  cursor: "pointer", transition: "all .15s", position: "relative",
                }}>
                  {m}
                  {fechada && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--surface)" }} />}
                </button>
              );
            });
          })()}
          <button onClick={() => setModalMesesProximos(true)} style={{
            background: "var(--surface3)", border: "1px solid var(--border)",
            color: "var(--muted)", borderRadius: 6, padding: "6px 12px",
            fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            🔮 Próximos meses
          </button>
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


// ─── TAB: Fluxo — Entradas ───────────────────────────────────────────────────
function Fluxo({ data, setData }) {
  const [mes, setMes] = useState(getMesAtual());
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [confirm, confirmDialog] = useConfirm();

  const fluxo = data.fluxo || {};
  const mesData = fluxo[mes] || { entradas: [], saidas: [] };
  const entradas = mesData.entradas || [];
  const totalEntradas = entradas.reduce((a, b) => a + (b.valor || 0), 0);

  // Saídas vêm automaticamente das outras abas
  const faturas = data.faturas || { bancos: [], itens: {} };

  // Por cartão — exclui lançamentos marcados como devedor
  const saidasPorCartao = (faturas.bancos || []).map(b => {
    const bItens = faturas.itens?.[b.id] || [];
    const naoDevedor = i => !i.isDevedor && !i.desc?.includes("'"); // isDevedor novo OU 'NOME legado
    const fixos = bItens.filter(i => i.tipo === "FIXO" && naoDevedor(i));
    const mesItens = bItens.filter(i => i.mes === mes && i.tipo !== "FIXO" && naoDevedor(i));
    return { id: b.id, nome: b.nome, cor: b.cor, valor: sum([...fixos, ...mesItens]) };
  }).filter(b => b.valor > 0);

  const totalFaturas = saidasPorCartao.reduce((a, b) => a + b.valor, 0);

  // Contas fixas — só as pagas ou reservadas
  const contaFixaPago = data.contaFixaPago || {};
  const contaFixaReserva = data.contaFixaReserva || {};
  const contasFixasFiltradas = data.contaFixa.filter(c => contaFixaPago[c.id] || contaFixaReserva[c.id]);
  const totalGastosFixos = sum(contasFixasFiltradas);

  // Gastos variáveis
  const totalGastosVar = sum(data.gastoVar);
  const totalSaidas = totalFaturas + totalGastosFixos + totalGastosVar;
  const saldo = totalEntradas - totalSaidas;

  const salvar = (novas) => {
    setData({ ...data, fluxo: { ...fluxo, [mes]: { ...mesData, entradas: novas } } });
  };

  const addEntrada = () => {
    if (!form.desc || !form.valor) return;
    const item = { id: Date.now(), desc: form.desc, valor: parseFloat(form.valor) || 0, data: form.data || "—", obs: form.obs || "" };
    salvar([...entradas, item]);
    toast.success("Entrada adicionada!");
    setModal(false); setForm({});
  };

  const delEntrada = (id) => confirm({
    title: "Excluir entrada", message: "Deseja excluir esta entrada?",
    onConfirm: () => { salvar(entradas.filter(e => e.id !== id)); toast.info("Removido"); }
  });

  // Gráfico histórico só de entradas
  const idxAtual = MESES.indexOf(mes);
  const mesesGrafico = MESES.slice(Math.max(0, idxAtual - 5), idxAtual + 1);
  const dadosGrafico = mesesGrafico.map(m => ({
    name: m.split("/")[0],
    Entradas: ((fluxo[m]?.entradas) || []).reduce((a, b) => a + (b.valor || 0), 0),
  }));

  const inp = (label, key, type = "text", ph = "") => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input type={type} placeholder={ph} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </div>
  );

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {confirmDialog}

      {/* Seletor de mês */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => { const i = MESES.indexOf(mes); if (i > 0) setMes(MESES[i-1]); }}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 15, minWidth: 80, textAlign: "center" }}>{mes}</span>
        <button onClick={() => { const i = MESES.indexOf(mes); if (i < MESES.length - 1) setMes(MESES[i+1]); }}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>→</button>
      </div>

      {/* Cards resumo */}
      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatBox label="Total Entradas" value={brl(totalEntradas)} color="var(--green)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0L5 12m7-7 7 7"/></svg>} />
        <StatBox label="Total Saídas" value={brl(totalSaidas)} color="var(--red)"
          sub="faturas + contas + variáveis"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m0 0 7-7m-7 7-7-7"/></svg>} />
        <StatBox label="Saldo do Mês" value={brl(saldo)} color={saldo >= 0 ? "var(--green)" : "var(--red)"}
          sub={saldo >= 0 ? "▲ no positivo" : "▼ no negativo"}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
      </div>

      {/* Detalhamento das saídas automáticas */}
      <Card>
        <SectionHead icon={Icons.barChart("currentColor")} title="Composição das Saídas" />

        {/* Faturas por cartão */}
        {saidasPorCartao.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Faturas por Cartão</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {saidasPorCartao.map(b => (
                <div key={b.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.cor }} />
                      <span style={{ fontSize: 13, color: "var(--text2)" }}>{b.nome}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: b.cor, fontFamily: "var(--font-head)" }}>{brl(b.valor)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: totalSaidas > 0 ? `${(b.valor/totalSaidas)*100}%` : "0%", background: b.cor }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contas fixas pagas/reservadas */}
        {contasFixasFiltradas.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Contas Fixas <span style={{ color: "var(--blue)" }}>(pagas/reservadas)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {contasFixasFiltradas.map(c => {
                const pago = contaFixaPago[c.id];
                const reservado = contaFixaReserva[c.id];
                return (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", background: "var(--surface3)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13, color: "var(--text2)" }}>{c.desc}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {pago && <span className="badge" style={{ background: "var(--green)18", color: "var(--green)", border: "1px solid var(--green)33" }}>✓ PAGO</span>}
                      {reservado && <span className="badge" style={{ background: "var(--blue)18", color: "var(--blue)", border: "1px solid var(--blue)33" }}>🔒 RESERVADO</span>}
                      <span style={{ fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-head)" }}>{brl(c.valor)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gastos variáveis */}
        {totalGastosVar > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Gastos Variáveis</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: "var(--text2)" }}>{data.gastoVar.length} lançamento(s)</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-head)" }}>{brl(totalGastosVar)}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: totalSaidas > 0 ? `${(totalGastosVar/totalSaidas)*100}%` : "0%", background: "var(--yellow)" }} />
            </div>
          </div>
        )}

        {/* Total */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>Total Saídas</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--red)", fontFamily: "var(--font-head)" }}>{brl(totalSaidas)}</span>
        </div>
      </Card>

      {/* Histórico entradas */}
      {dadosGrafico.some(d => d.Entradas > 0) && (
        <Card>
          <SectionHead icon={Icons.chart("currentColor")} title="Histórico de Entradas" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dadosGrafico} barSize={24}>
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="Entradas" fill="var(--green)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Lista de entradas */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <SectionHead icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0L5 12m7-7 7 7"/></svg>} title="Entradas" color="var(--green)" />
          <Btn small solid color="var(--green)" onClick={() => { setForm({}); setModal(true); }}>+ Entrada</Btn>
        </div>
        {entradas.length === 0 ? (
          <div className="empty-state" style={{ padding: "28px 0" }}>
            <div className="empty-state-icon" style={{ fontSize: 32 }}>💰</div>
            <div className="empty-state-title">Nenhuma entrada em {mes}</div>
            <div className="empty-state-desc">Registre salários, freelances ou qualquer receita</div>
          </div>
        ) : (
          <div style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", overflow: "hidden" }}>
            {entradas.map((e, i) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < entradas.length - 1 ? "1px solid var(--border)" : "none", background: i % 2 === 0 ? "transparent" : "var(--surface3)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.desc}</div>
                  {e.data !== "—" && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{e.data}</div>}
                  {e.obs && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontStyle: "italic" }}>{e.obs}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-head)", fontSize: 15 }}>{brl(e.valor)}</span>
                  <button onClick={() => delEntrada(e.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>{Icons.trash("var(--red)")}</button>
                </div>
              </div>
            ))}
            <div style={{ padding: "10px 16px", background: "var(--surface3)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>Total {mes}</span>
              <span style={{ fontWeight: 800, color: "var(--green)", fontFamily: "var(--font-head)", fontSize: 16 }}>{brl(totalEntradas)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Modal nova entrada */}
      {modal && (
        <Modal title="Nova Entrada" onClose={() => { setModal(false); setForm({}); }}>
          {inp("Descrição", "desc", "text", "Ex: Salário, Freelance, Pix recebido...")}
          {inp("Valor (R$)", "valor", "number", "0,00")}
          {inp("Data", "data", "text", "DD/MM/AA")}
          {inp("Observação (opcional)", "obs", "text", "")}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn onClick={() => { setModal(false); setForm({}); }}>Cancelar</Btn>
            <Btn solid color="var(--green)" onClick={addEntrada}>+ Adicionar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

const TABS = [
  { id: "dashboard", label: "Dashboard",        icon: Icons.dashboard },
  { id: "gastos",    label: "Gastos",            icon: Icons.gastos    },
  { id: "saldos",    label: "Saldos",            icon: Icons.saldos    },
  { id: "devedores", label: "Devedores",         icon: Icons.devedores },
  { id: "faturas",   label: "Faturas",           icon: Icons.faturas   },
  { id: "fluxo",     label: "Entradas e Saídas", icon: Icons.fluxo     },
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
    if (dias < 0)  return "atrasado";  // vencida — permanente
    if (dias === 0) return "hoje";      // hoje — permanente
    if (dias === 1) return "amanha";   // 24h — dispensável
    if (dias <= 3)  return "breve";    // em breve — dispensável
    return null;
  };

  // "permanente" = só sai ao pagar/excluir; "dispensavel" = pode fechar manualmente
  const tipoPermanencia = { atrasado: "permanente", hoje: "permanente", amanha: "dispensavel", breve: "dispensavel" };
  const corUrgencia = { atrasado: "var(--red)", hoje: "var(--red)", amanha: "var(--yellow)", breve: "var(--blue)" };
  const labelUrgencia = { atrasado: "ATRASADO", hoje: "HOJE", amanha: "AMANHÃ", breve: "EM BREVE" };

  // ── 1. Contas Fixas ──────────────────────────────────────────────
  (data.contaFixa || []).forEach(c => {
    const dia = parseDia(c.venc);
    if (!dia) return;
    const dataVenc = new Date(anoAtual, mesAtual, dia);
    const dias = diffDias(dataVenc);
    const u = urgencia(dias);
    if (!u) return;
    const paga = !!(data.contaFixaPago || {})[c.id];
    if (paga) return; // conta paga não aparece como notificação
    notifs.push({
      id: `conta-${c.id}`,
      tipo: "conta",
      titulo: c.desc,
      detalhe: `Vence dia ${dia} — ${brl(c.valor)}`,
      cor: corUrgencia[u],
      badge: labelUrgencia[u],
      dias,
      permanente: tipoPermanencia[u] === "permanente",
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
      permanente: tipoPermanencia[u] === "permanente",
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
      permanente: tipoPermanencia[u] === "permanente",
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
function PainelNotificacoes({ data, setData, onClose }) {
  const notifs = gerarNotificacoes(data);
  const tipoIcon = { conta: "📅", fatura: "💳", devedor: "👤", parcela: "🔁" };

  const dispensadas = data.notifDispensadas || [];
  // Permanentes (vencidas/hoje): só somem se paga ou excluída
  // Dispensáveis: podem ser fechadas manualmente
  const visiveis = notifs.filter(n => {
    if (n.permanente && !n.paga) return true; // sempre mostra
    return !dispensadas.includes(n.id);
  });

  const dispensar = (id) => {
    const n = notifs.find(x => x.id === id);
    if (n?.permanente) return; // não deixa dispensar permanentes
    setData({ ...data, notifDispensadas: [...dispensadas, id] });
  };
  const limparTodas = () => {
    // só limpa as dispensáveis
    const dispensaveis = notifs.filter(n => !n.permanente).map(n => n.id);
    setData({ ...data, notifDispensadas: [...dispensadas, ...dispensaveis] });
  };
  const marcarContaPaga = (contaId) => {
    setData({ ...data, contaFixaPago: { ...(data.contaFixaPago || {}), [contaId]: true } });
    toast.success("Conta marcada como paga!");
  };

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
            {visiveis.length > 0 && (
              <span style={{ background: "var(--red)", color: "#fff", borderRadius: "100px", padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                {visiveis.length}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {visiveis.length > 1 && (
              <button onClick={limparTodas} style={{
                background: "var(--surface3)", border: "1px solid var(--border)",
                color: "var(--muted)", borderRadius: 6, padding: "4px 10px",
                fontSize: 11, cursor: "pointer", fontFamily: "var(--font-body)",
              }}>Limpar tudo</button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>✕</button>
          </div>
        </div>

        {visiveis.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: "var(--font-head)", fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Tudo em dia!</div>
            <div style={{ fontSize: 13 }}>Nenhum vencimento nos próximos 3 dias.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visiveis.map(n => (
              <div key={n.id} style={{
                background: n.cor + "0d",
                border: `1px solid ${n.cor}33`,
                borderLeft: `3px solid ${n.cor}`,
                borderRadius: 10, padding: "14px 16px",
                position: "relative",
                opacity: n.paga ? 0.5 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{tipoIcon[n.tipo]}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", textDecoration: n.paga ? "line-through" : "none" }}>{n.titulo}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: n.cor + "22", color: n.cor, border: `1px solid ${n.cor}44`, whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>{n.badge}</span>
                    {/* Permanentes: botão Pago (conta) ou só badge. Dispensáveis: botão X */}
                    {n.permanente && n.tipo === "conta" && !n.paga && (
                      <button onClick={() => marcarContaPaga(n.id.replace("conta-", ""))}
                        style={{ background: "var(--green)22", border: "1px solid var(--green)44", color: "var(--green)", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        ✓ Pago
                      </button>
                    )}
                    {!n.permanente && (
                      <button onClick={() => dispensar(n.id)} title="Dispensar"
                        style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1, opacity: 0.6 }}>✕</button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", paddingLeft: 24 }}>{n.detalhe}</div>
                {n.permanente && !n.paga && <div style={{ fontSize: 10, color: n.cor, paddingLeft: 24, marginTop: 4, fontWeight: 600 }}>⚠ Esta notificação só sai após pagamento</div>}
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

  // Reset das contas fixas todo dia 5 — dependência específica evita loop
  useEffect(() => {
    if (!data) return;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dia = now.getDate();
    const mesAno = `${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;
    const jaResetou = (data.contaFixaResetMes || "") === mesAno;
    if (dia >= 5 && !jaResetou && Object.keys(data.contaFixaPago || {}).length > 0) {
      setData(prev => ({ ...prev, contaFixaPago: {}, contaFixaResetMes: mesAno }));
    }
  }, [data?.contaFixaResetMes, data?.id]);

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

  const notifCount = data ? gerarNotificacoes(data).filter(x => !(data.notifDispensadas || []).includes(x.id)).length : 0;
  const userEmail = session?.user?.email || "";
  const userInitials = userEmail.substring(0, 2).toUpperCase();

  return (
    <ToastProvider>
    <div className="app-layout">
      <GlobalStyle />

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(249,115,22,0.4)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 0.3 }}>FOCO7</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>Finanças</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 10, border: "none",
                background: active ? "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(234,88,12,0.15))" : "transparent",
                color: active ? "#fff" : "var(--muted)",
                fontWeight: active ? 600 : 400, fontSize: 14,
                cursor: "pointer", transition: "all .15s", textAlign: "left", width: "100%",
                boxShadow: active ? "inset 0 0 0 1px rgba(249,115,22,0.3)" : "none",
              }}
              onMouseOver={e => { if (!active) e.currentTarget.style.background = "var(--surface3)"; }}
              onMouseOut={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ opacity: active ? 1 : 0.6 }}>{t.icon(active ? "var(--accent)" : "currentColor")}</span>
                {t.label}
              </button>
            );
          })}


        </nav>

        {/* User footer */}
        <div style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--surface3)" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{userInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail.split("@")[0]}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>@pecora.77</div>
            </div>
            <button onClick={handleLogout} title="Sair" style={{ background: "none", border: "none", color: "var(--muted)", padding: 4, display: "flex", borderRadius: 6 }}
              onMouseOver={e => e.currentTarget.style.color = "var(--red)"}
              onMouseOut={e => e.currentTarget.style.color = "var(--muted)"}
            >{Icons.logout("currentColor")}</button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="main-content">
        {/* Sino fixo canto superior direito */}
        <button onClick={() => setPainelNotif(true)} style={{
          position: "fixed", top: 20, right: 24, zIndex: 200,
          width: 42, height: 42, borderRadius: 12,
          background: "var(--surface)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all .18s",
          boxShadow: notifCount > 0 ? "0 0 0 2px var(--accent)44" : "none",
        }}
          onMouseOver={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--surface2)"; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
        >
          {Icons.bell(notifCount > 0 ? "var(--accent)" : "var(--muted)")}
          {notifCount > 0 && (
            <span style={{
              position: "absolute", top: -5, right: -5,
              background: "var(--red)", color: "#fff", borderRadius: 99,
              minWidth: 18, height: 18, fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 4px", border: "2px solid var(--surface)",
            }}>{notifCount}</span>
          )}
        </button>

        {/* Page header — sem barra de abas */}
        <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--border)", background: "rgba(20,20,20,0.7)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50 }}>
          <h1 style={{ fontWeight: 800, fontSize: 28, letterSpacing: -0.5, lineHeight: 1 }}>
            {TABS.find(t => t.id === tab)?.label || "Dashboard"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            {tab === "dashboard"  && "Visão geral das suas finanças"}
            {tab === "gastos"     && "Controle de gastos fixos e variáveis"}
            {tab === "saldos"     && "Saldos e reservas em conta"}
            {tab === "devedores"  && "Quem te deve e quanto"}
            {tab === "faturas"    && "Faturas dos seus cartões"}
            {tab === "fluxo"      && "Registro de entradas e saídas mensais"}
          </p>
        </div>

        {/* Page content */}
        <div className="page-pad" style={{ padding: "28px 32px" }}>
          {tab === "dashboard"  && <Dashboard data={data} />}
          {tab === "gastos"     && <Gastos data={data} setData={setData} />}
          {tab === "saldos"     && <Saldos data={data} setData={setData} />}
          {tab === "devedores"  && <Devedores data={data} setData={setData} />}
          {tab === "faturas"    && <Faturas data={data} setData={setData} />}
          {tab === "fluxo"      && <Fluxo data={data} setData={setData} />}
        </div>
      </div>

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="bottom-nav">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 3, background: "none", border: "none",
              color: active ? "var(--accent)" : "var(--muted)", padding: "4px 0",
            }}>
              <div style={{ width: 36, height: 24, borderRadius: 99, background: active ? "var(--accent-glow)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .2s" }}>
                {t.icon(active ? "var(--accent)" : "var(--muted)")}
              </div>
              <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 400 }}>{t.label}</span>
            </button>
          );
        })}
        <button onClick={() => setPainelNotif(true)} style={{ position: "relative", width: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", color: notifCount > 0 ? "var(--accent)" : "var(--muted)", padding: "4px 0" }}>
          <div style={{ width: 36, height: 24, borderRadius: 99, background: notifCount > 0 ? "var(--accent-glow)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {Icons.bell(notifCount > 0 ? "var(--accent)" : "var(--muted)")}
          </div>
          {notifCount > 0 && <span style={{ position: "absolute", top: 2, right: 6, background: "var(--red)", color: "#fff", borderRadius: 99, width: 14, height: 14, fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{notifCount}</span>}
          <span style={{ fontSize: 9.5 }}>Alertas</span>
        </button>
        <button onClick={handleLogout} style={{ width: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", color: "var(--muted)", padding: "4px 0" }}>
          <div style={{ width: 36, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>{Icons.logout("var(--muted)")}</div>
          <span style={{ fontSize: 9.5 }}>Sair</span>
        </button>
      </nav>

      {/* ── Sino flutuante canto superior direito ── */}
      {data && (() => {
        return (
          <button onClick={() => setPainelNotif(true)} style={{
            position: "fixed", top: 20, right: 24, zIndex: 200,
            width: 42, height: 42, borderRadius: "50%",
            background: notifCount > 0
              ? "linear-gradient(135deg, var(--accent), var(--accent2))"
              : "var(--surface2)",
            border: `1px solid ${notifCount > 0 ? "transparent" : "var(--border)"}`,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            boxShadow: notifCount > 0 ? "0 4px 16px rgba(249,115,22,0.45)" : "0 2px 8px rgba(0,0,0,0.4)",
            transition: "all .2s",
          }}
          onMouseOver={e => e.currentTarget.style.transform = "scale(1.08)"}
          onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
          >
            {Icons.bell(notifCount > 0 ? "#fff" : "var(--muted)")}
            {notifCount > 0 && (
              <span style={{
                position: "absolute", top: -3, right: -3,
                background: "var(--red)", color: "#fff",
                borderRadius: 99, minWidth: 17, height: 17,
                fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 4px",
                border: "2px solid var(--bg)",
              }}>{notifCount}</span>
            )}
          </button>
        );
      })()}

      {painelNotif && data && (
        <PainelNotificacoes data={data} setData={setData} onClose={() => setPainelNotif(false)} />
      )}
    </div>
    </ToastProvider>
  );
}
