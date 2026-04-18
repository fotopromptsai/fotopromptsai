import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Aperture, Mail, Lock, Loader2, AlertCircle, X } from "lucide-react";
import { signIn, signUp } from "@/src/lib/auth";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOpacity, setVideoOpacity] = useState(1);

  const clearForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccessMsg(null);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    clearForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Insira um e-mail válido.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);

    if (mode === "login") {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(
          err.message.includes("Invalid login credentials")
            ? "E-mail ou senha incorretos."
            : err.message
        );
      }
    } else {
      const { error: err } = await signUp(email, password);
      if (err) {
        setError(
          err.message.includes("already registered")
            ? "Este e-mail já está cadastrado."
            : err.message
        );
      } else {
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setError(null);
        setMode("login");
        setSuccessMsg("ok");
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col items-center justify-center p-6">
      {/* Background video */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ opacity: videoOpacity * 0.35, transition: "opacity 0.1s linear" }}
          className="absolute inset-0 w-full h-full object-cover"
          onTimeUpdate={() => {
            const v = videoRef.current;
            if (!v) return;
            if (v.currentTime >= 1) setVideoOpacity(Math.max(0, 1 - (v.currentTime - 1) / 2));
          }}
        >
          <source src="https://virzbumsdzybwnkfcisl.supabase.co/storage/v1/object/public/video/video.mp4" type="video/mp4" />
        </video>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-[#050505]/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/40 via-transparent to-[#050505]/40" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative flex items-center justify-center mb-4">
            <motion.div
              className="absolute inset-0 rounded-full bg-orange-500/30 blur-md"
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.15, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            >
              <Aperture className="w-12 h-12 text-orange-500 relative z-10" />
            </motion.div>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            PersonaRefine <span className="text-orange-500">AI</span>
          </h1>
          <p className="text-white/40 text-xs tracking-widest mt-1 uppercase">
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/10 rounded-[28px] p-8">
          {/* Mode toggle */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-8">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all ${
                  mode === m
                    ? "bg-orange-500 text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {m === "login" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>

          {/* Feedback messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5 text-xs text-red-400"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
              </motion.div>
            )}
            {successMsg === "ok" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-4 mb-5 text-xs text-green-400 space-y-2"
              >
                <p className="font-bold">✅ Conta criada com sucesso!</p>
                <p className="text-green-400/80 leading-relaxed">
                  Enviamos um link de confirmação para o seu e-mail.<br />
                  Verifique sua <span className="text-green-300 font-semibold">caixa de entrada</span> ou a pasta <span className="text-green-300 font-semibold">spam/lixo eletrônico</span> e clique no link antes de entrar.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha (mín. 6 caracteres)"
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>

            <AnimatePresence>
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative overflow-hidden"
                >
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmar senha"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-orange-500 text-white text-xs font-bold tracking-widest rounded-2xl hover:bg-orange-600 transition-colors active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "login" ? (
                "Entrar"
              ) : (
                "Criar conta"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-white/20 mt-8 tracking-widest uppercase">
          © 2026 PersonaRefine AI
        </p>
      </motion.div>
    </div>
  );
}
