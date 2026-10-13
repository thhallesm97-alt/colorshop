import React from "react";
import { X } from "lucide-react";

export const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500";

export const btnPrimario =
  "inline-flex items-center justify-center gap-1.5 text-sm font-medium bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3.5 py-2 shadow-sm transition-colors";
export const btnSecundario =
  "inline-flex items-center justify-center gap-1.5 text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-3.5 py-2 transition-colors disabled:opacity-40";
export const btnContorno =
  "inline-flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 border border-emerald-700/40 rounded-md px-2.5 py-1 transition-colors";
export const btnIcone = "p-1.5 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors";
export const btnIconePerigo = "p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors";

export function Badge({ status }) {
  const map = {
    Pago: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    Pendente: "bg-amber-50 text-amber-700 ring-amber-600/20",
    Atrasada: "bg-red-50 text-red-700 ring-red-600/20",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${map[status] || "bg-slate-100 text-slate-700 ring-slate-500/20"}`}>
      {status}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }) {
  React.useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} my-8`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tom = "emerald" }) {
  const tons = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tons[tom]}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="text-2xl font-semibold text-slate-900 tracking-tight">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export function TableShell({ title, sub, action, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-4 border-b border-slate-100">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {sub && <div className="text-xs text-slate-400">{sub}</div>}
        </div>
        {action}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Th({ children, right }) {
  return <th className={`px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

export function Td({ children, className = "", right, colSpan }) {
  return <td colSpan={colSpan} className={`px-5 py-3 align-top ${right ? "text-right" : ""} ${className}`}>{children}</td>;
}

export function Vazio({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-slate-400 text-sm">
        {children}
      </td>
    </tr>
  );
}

export function Cartao({ title, sub, children, action, className = "" }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <div className="text-sm font-semibold text-slate-900">{title}</div>}
            {sub && <div className="text-xs text-slate-400">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Segmentado({ opcoes, valor, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${valor === o.valor ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
