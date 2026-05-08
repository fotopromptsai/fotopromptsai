import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, ScrollText, Loader2, RefreshCw, Check, X, BookImage, Pencil, Trash2 } from "lucide-react";
import {
  fetchAdminUsers, fetchAdminLogs, setUserCredits,
  type AdminUser, type AdminLog,
} from "@/src/lib/admin";
import AlbumsAdmin from "@/src/components/AlbumsAdmin";

type Tab = "users" | "logs" | "albums";

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState("");
  const [savingCredit, setSavingCredit] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = async (t: Tab = tab) => {
    setLoading(true);
    if (t === "users") {
      const u = await fetchAdminUsers();
      setUsers(u);
    } else if (t === "logs") {
      const l = await fetchAdminLogs();
      setLogs(l);
    }
    setLoading(false);
  };

  useEffect(() => { load(tab); }, [tab]);

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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "users", label: "Usuários", icon: <Users className="w-4 h-4" /> },
    { id: "logs", label: "Logs", icon: <ScrollText className="w-4 h-4" /> },
    { id: "albums", label: "Álbuns", icon: <BookImage className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-5 shrink-0">
        <h3 className="text-lg font-black tracking-tighter">Painel Admin</h3>
        <button onClick={() => load(tab)} disabled={loading} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/70 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/5 rounded-2xl p-1.5 mb-6 shrink-0 gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold tracking-widest transition-all ${
              tab === t.id ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-white/40 hover:text-white/70"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
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
                <p className="text-[9px] tracking-widest text-white/20 mb-4">{users.length} USUÁRIOS CADASTRADOS</p>
                {users.map(u => (
                  <div key={u.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-[11px] text-white/80 font-semibold truncate">{u.email}</p>
                        <p className="text-[9px] text-white/25 mt-0.5">
                          Cadastro: {new Date(u.created_at).toLocaleDateString("pt-BR")}
                          {u.last_reset && ` · Reset: ${new Date(u.last_reset).toLocaleDateString("pt-BR")}`}
                        </p>
                      </div>
                      <button
                        onClick={() => { setEditingUser(editingUser === u.id ? null : u.id); setEditCredits(String(u.credits)); }}
                        className="p-1.5 bg-white/5 hover:bg-orange-500/10 rounded-lg transition-colors shrink-0"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5 text-white/30 hover:text-orange-400" />
                      </button>
                    </div>

                    {editingUser === u.id ? (
                      <div className="bg-white/[0.03] rounded-xl p-3 space-y-3 border border-white/8">
                        <p className="text-[9px] tracking-widest text-white/30 font-bold">EDITAR CRÉDITOS</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={editCredits}
                            onChange={e => setEditCredits(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveCredits(u.id)}
                            disabled={savingCredit}
                            className="p-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                          >
                            {savingCredit ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                          <button onClick={() => setEditingUser(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-3.5 h-3.5 text-white/50" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-black ${u.credits > 0 ? "text-orange-400" : "text-red-400"}`}>
                          {savedId === u.id ? (
                            <span className="text-green-400 text-xs flex items-center gap-1"><Check className="w-3 h-3" /> Salvo</span>
                          ) : (
                            `${u.credits} crédito${u.credits !== 1 ? "s" : ""}`
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {users.length === 0 && <p className="text-[10px] text-white/20 text-center py-8">Nenhum usuário encontrado.</p>}
              </motion.div>
            )}

            {tab === "logs" && (
              <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                <p className="text-[9px] tracking-widest text-white/20 mb-4">ÚLTIMAS {logs.length} GERAÇÕES</p>
                {logs.map(l => (
                  <div key={l.id} className="flex gap-3 bg-white/[0.03] border border-white/5 rounded-2xl p-3">
                    {l.result_image_url && (
                      <img src={l.result_image_url} alt="" className="w-12 h-14 object-cover rounded-xl shrink-0" referrerPolicy="no-referrer" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-orange-400/80 font-semibold truncate">{l.email}</p>
                      <p className="text-[9px] text-white/20 mb-1">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
                      <p className="text-[9px] text-white/40 leading-relaxed line-clamp-2">{l.prompt}</p>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-[10px] text-white/20 text-center py-8">Nenhuma geração ainda.</p>}
              </motion.div>
            )}

            {tab === "albums" && (
              <motion.div key="albums" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AlbumsAdmin />
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
