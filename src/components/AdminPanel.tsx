import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, ScrollText, CreditCard, Loader2, RefreshCw, Check, X, DollarSign } from "lucide-react";
import {
  fetchAdminUsers, fetchAdminLogs, fetchUsageStats, setUserCredits,
  type AdminUser, type AdminLog, type UsageStat,
  LOVABLE_BUDGET, COST_ANALYZE, COST_GENERATE,
} from "@/src/lib/admin";

type Tab = "users" | "logs" | "credits" | "custos";

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [usage, setUsage] = useState<UsageStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState("");
  const [savingCredit, setSavingCredit] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [u, l, s] = await Promise.all([fetchAdminUsers(), fetchAdminLogs(), fetchUsageStats()]);
    setUsers(u);
    setLogs(l);
    setUsage(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSaveCredits = async (userId: string) => {
    const val = parseInt(editCredits);
    if (isNaN(val) || val < 0) return;
    setSavingCredit(true);
    const ok = await setUserCredits(userId, val);
    if (ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, credits: val } : u));
      setSavedId(userId);
      setTimeout(() => setSavedId(null), 2000);
      setEditingUser(null);
    }
    setSavingCredit(false);
  };

  const totalCost = usage.reduce((s, u) => s + u.total_cost, 0);
  const totalAnalyze = usage.reduce((s, u) => s + u.analyze_count, 0);
  const totalGenerate = usage.reduce((s, u) => s + u.generate_count, 0);
  const budgetPct = Math.min((totalCost / LOVABLE_BUDGET) * 100, 100);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "users", label: "Usuários", icon: <Users className="w-3 h-3" /> },
    { id: "logs", label: "Logs", icon: <ScrollText className="w-3 h-3" /> },
    { id: "credits", label: "Créditos", icon: <CreditCard className="w-3 h-3" /> },
    { id: "custos", label: "Custos", icon: <DollarSign className="w-3 h-3" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-lg font-black tracking-tighter">Painel Admin</h3>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/70 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex bg-white/5 rounded-xl p-1 mb-5 shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[8px] font-bold tracking-widest transition-all ${
              tab === t.id ? "bg-orange-500 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
          </div>
        ) : (
          <AnimatePresence mode="wait">

            {tab === "users" && (
              <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                <p className="text-[9px] tracking-widest text-white/20 mb-3">{users.length} USUÁRIOS CADASTRADOS</p>
                {users.map(u => (
                  <div key={u.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                    <p className="text-[11px] text-white/80 font-semibold truncate mb-0.5">{u.email}</p>
                    <p className="text-[9px] text-white/25 mb-2">
                      Cadastro: {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      {u.last_reset && ` · Reset: ${new Date(u.last_reset).toLocaleDateString("pt-BR")}`}
                    </p>
                    <span className={`text-[10px] font-bold ${u.credits > 0 ? "text-orange-400" : "text-red-400"}`}>
                      {u.credits} crédito{u.credits !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
                {users.length === 0 && <p className="text-[10px] text-white/20 text-center py-8">Nenhum usuário encontrado.</p>}
              </motion.div>
            )}

            {tab === "logs" && (
              <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                <p className="text-[9px] tracking-widest text-white/20 mb-3">ÚLTIMAS {logs.length} GERAÇÕES</p>
                {logs.map(l => (
                  <div key={l.id} className="flex gap-2.5 bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                    {l.result_image_url && (
                      <img src={l.result_image_url} alt="" className="w-10 h-12 object-cover rounded-lg shrink-0" referrerPolicy="no-referrer" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] text-orange-400/80 font-semibold truncate">{l.email}</p>
                      <p className="text-[9px] text-white/20 mb-1">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
                      <p className="text-[9px] text-white/40 leading-relaxed line-clamp-2">{l.prompt}</p>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-[10px] text-white/20 text-center py-8">Nenhuma geração ainda.</p>}
              </motion.div>
            )}

            {tab === "credits" && (
              <motion.div key="credits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                <p className="text-[9px] tracking-widest text-white/20 mb-3">AJUSTAR CRÉDITOS POR USUÁRIO</p>
                {users.map(u => (
                  <div key={u.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                    <p className="text-[10px] text-white/70 truncate mb-2">{u.email}</p>
                    {editingUser === u.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={0} value={editCredits}
                          onChange={e => setEditCredits(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-orange-500/50"
                          autoFocus
                        />
                        <button onClick={() => handleSaveCredits(u.id)} disabled={savingCredit} className="p-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors">
                          {savingCredit ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : <Check className="w-3 h-3 text-white" />}
                        </button>
                        <button onClick={() => setEditingUser(null)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                          <X className="w-3 h-3 text-white/50" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold ${u.credits > 0 ? "text-orange-400" : "text-red-400"}`}>
                          {savedId === u.id ? "✓ Salvo" : `${u.credits} crédito${u.credits !== 1 ? "s" : ""}`}
                        </span>
                        <button onClick={() => { setEditingUser(u.id); setEditCredits(String(u.credits)); }} className="text-[9px] tracking-widest text-white/30 hover:text-orange-400 transition-colors">
                          EDITAR
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {users.length === 0 && <p className="text-[10px] text-white/20 text-center py-8">Nenhum usuário encontrado.</p>}
              </motion.div>
            )}

            {tab === "custos" && (
              <motion.div key="custos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                {/* Resumo geral */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                  <p className="text-[9px] tracking-widest text-white/20 mb-3">USO TOTAL ACUMULADO</p>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-2xl font-black text-white">${totalCost.toFixed(3)}</span>
                    <span className="text-[10px] text-white/30">/ ${LOVABLE_BUDGET.toFixed(2)}</span>
                  </div>
                  {/* Barra de progresso */}
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all ${budgetPct >= 90 ? "bg-red-500" : budgetPct >= 70 ? "bg-orange-400" : "bg-orange-500"}`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                      <p className="text-[9px] text-white/20 mb-0.5">Análises</p>
                      <p className="text-[13px] font-bold text-white">{totalAnalyze}</p>
                      <p className="text-[8px] text-white/20">${COST_ANALYZE}/un</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                      <p className="text-[9px] text-white/20 mb-0.5">Gerações</p>
                      <p className="text-[13px] font-bold text-white">{totalGenerate}</p>
                      <p className="text-[8px] text-white/20">${COST_GENERATE}/un</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                      <p className="text-[9px] text-white/20 mb-0.5">Restante</p>
                      <p className={`text-[13px] font-bold ${(LOVABLE_BUDGET - totalCost) < 0.20 ? "text-red-400" : "text-green-400"}`}>
                        ${Math.max(LOVABLE_BUDGET - totalCost, 0).toFixed(3)}
                      </p>
                      <p className="text-[8px] text-white/20">estimado</p>
                    </div>
                  </div>
                </div>

                {/* Por projeto */}
                {usage.length > 0 && (
                  <div>
                    <p className="text-[9px] tracking-widest text-white/20 mb-2">POR PROJETO LOVABLE</p>
                    <div className="space-y-2">
                      {usage.map((u, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                          <p className="text-[9px] text-white/30 truncate mb-2 font-mono">{u.lovable_url.replace("https://", "").replace(".supabase.co", "")}</p>
                          <div className="flex justify-between items-center">
                            <div className="flex gap-3">
                              <span className="text-[9px] text-white/40">{u.analyze_count} análises</span>
                              <span className="text-[9px] text-white/40">{u.generate_count} gerações</span>
                            </div>
                            <span className="text-[11px] font-bold text-orange-400">${u.total_cost.toFixed(3)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {usage.length === 0 && <p className="text-[10px] text-white/20 text-center py-8">Nenhuma chamada registrada ainda.</p>}
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
