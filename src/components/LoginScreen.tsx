import React, { useState, useEffect } from "react";
import { Shield, Lock, Sun, Moon, Clock, ShieldCheck } from "lucide-react";
import { ThemeColors, User } from "../types";
import { Btn, PwInput } from "./SharedUI";
import { LgpdModal } from "./LgpdModal";

interface LoginScreenProps {
  mode: string;
  t: ThemeColors;
  users: User[];
  onLogin: (matricula: string) => void;
  isAdminMode: boolean;
  setIsAdminMode: React.Dispatch<React.SetStateAction<boolean>>;
  onToggleTheme: () => void;
}

export function LoginScreen({ mode, t, users, onLogin, isAdminMode, setIsAdminMode, onToggleTheme }: LoginScreenProps) {
  const [mat, setMat] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [shieldAnim, setShieldAnim] = useState(false);
  const [isLgpdOpen, setIsLgpdOpen] = useState(false);

  // Safe Monotonic NTP-like Clock Sync states
  const [baseRealTime, setBaseRealTime] = useState<number | null>(null);
  const [basePerfTime, setBasePerfTime] = useState<number | null>(null);
  const [clockStatus, setClockStatus] = useState<"syncing" | "synced" | "local">("syncing");
  const [now, setNow] = useState<Date>(new Date());

  const [triggerSync, setTriggerSync] = useState(0);

  const getSyncDate = () => {
    if (baseRealTime !== null && basePerfTime !== null) {
      const elapsed = performance.now() - basePerfTime;
      return new Date(baseRealTime + elapsed);
    }
    return new Date();
  };

  // Safe Brasilia clock sync routine
  useEffect(() => {
    let active = true;

    async function syncTime() {
      setClockStatus("syncing");
      const urls = [
        "https://worldtimeapi.org/api/timezone/America/Sao_Paulo",
        "https://timeapi.io/api/Time/current/zone?timeZone=America/Sao_Paulo",
        "https://date.jsontest.com",
        "https://api.allorigins.win/get?url=https%3A%2F%2Fworldtimeapi.org%2Fapi%2Ftimezone%2FAmerica%2FSao_Paulo"
      ];

      for (const url of urls) {
        try {
          const start = performance.now();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (!active) return;

            let apiEpoch = 0;
            if (url.includes("allorigins")) {
              const innerData = JSON.parse(data.contents);
              if (innerData && innerData.datetime) {
                apiEpoch = new Date(innerData.datetime).getTime();
              }
            } else if (url.includes("worldtimeapi")) {
              if (data.datetime) {
                apiEpoch = new Date(data.datetime).getTime();
              }
            } else if (url.includes("timeapi")) {
              if (data.dateTime) {
                apiEpoch = new Date(data.dateTime).getTime();
              }
            } else if (url.includes("jsontest")) {
              if (data.milliseconds_since_epoch) {
                apiEpoch = data.milliseconds_since_epoch;
              }
            }

            if (apiEpoch) {
              const end = performance.now();
              const rtt = end - start;
              const realEpoch = apiEpoch + rtt / 2;
              
              setBaseRealTime(realEpoch);
              setBasePerfTime(performance.now());
              setClockStatus("synced");
              setNow(new Date(realEpoch));
              console.log(`[Login Clock Sync] Sucesso usando ${url}. RTT: ${rtt.toFixed(1)}ms.`);
              return;
            }
          }
        } catch (e) {
          console.warn(`[Login Clock Sync] Falha ao sincronizar com ${url}:`, e);
        }
      }

      if (active) {
        console.warn("[Login Clock Sync] Todos os serviços de horário falharam. Usando relógio local.");
        setBaseRealTime(Date.now());
        setBasePerfTime(performance.now());
        setClockStatus("local");
        setNow(new Date());
      }
    }

    syncTime();

    return () => {
      active = false;
    };
  }, [triggerSync]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(getSyncDate());
    }, 1000);
    return () => clearInterval(timer);
  }, [baseRealTime, basePerfTime]);

  function handleShield() {
    setShieldAnim(true);
    setTimeout(() => {
      setIsAdminMode(v => !v);
      setMat("");
      setPw("");
      setError("");
      setShieldAnim(false);
    }, 220);
  }

  function submit() {
    setError("");
    const matOk = mat.trim().length >= 4;
    if (!matOk) {
      setError("Matrícula inválida (mín. 4 caracteres).");
      return;
    }
    if (!pw) {
      setError("Informe a senha.");
      return;
    }

    // Find user
    const user = users.find(u => u.matricula === mat.trim() && !u.desativado);
    if (!user) {
      setError("Matrícula não cadastrada.");
      return;
    }
    if (user.senha !== pw) {
      setError("Senha incorreta.");
      return;
    }
    if (user.bloqueado) {
      setError("Acesso bloqueado. Contate o administrador.");
      return;
    }
    if (isAdminMode && user.tipo !== "adm-dev") {
      setError("Esta conta não possui credenciais de Administrador.");
      return;
    }
    if (!isAdminMode && user.tipo === "adm-dev") {
      setError("Administradores devem entrar pelo painel ADM (tópico superior esquerdo).");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(user.matricula);
    }, 900);
  }

  const inputSt = (f: string): React.CSSProperties => ({
    width: "100%",
    boxSizing: "border-box",
    background: t.inputBg,
    border: `1.5px solid ${focused === f ? t.borderFocus : t.border}`,
    borderRadius: 9,
    color: t.text,
    fontSize: "14.5px",
    padding: "12px 14px",
    outline: "none",
    fontFamily: "inherit",
    boxShadow: focused === f ? `0 0 0 3px ${t.accentGlow}` : "none",
    transition: "border 0.2s, box-shadow 0.2s"
  });

  const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", weekday: "short" });
  const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Decorative gradients */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `radial-gradient(ellipse at 15% 15%, ${t.accentGlow} 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(80,30,180,0.05) 0%, transparent 55%)`
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: mode === "dark" ? 0.03 : 0.015,
          backgroundImage: `linear-gradient(${t.text} 1px,transparent 1px),linear-gradient(90deg,${t.text} 1px,transparent 1px)`,
          backgroundSize: "36px 36px"
        }}
      />

      {/* Admin Mode Toggle and LGPD Button */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: shieldAnim ? 0 : 1,
          transition: "all 0.22s"
        }}
      >
        <button
          onClick={handleShield}
          title={isAdminMode ? "Voltar ao login colaborador" : "Acesso ADM-Dev"}
          style={{
            background: isAdminMode ? t.accent : t.surfaceAlt,
            border: `1.5px solid ${isAdminMode ? t.accent : t.border}`,
            borderRadius: 11,
            padding: "8px 11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 7,
            boxShadow: isAdminMode ? `0 0 20px ${t.accentGlow}` : "none",
            transition: "all 0.22s"
          }}
        >
          <Shield size={20} color={isAdminMode ? "#fff" : t.accent} fill={isAdminMode ? t.accent : "none"} />
          {isAdminMode && (
            <span style={{ color: "#fff", fontSize: "11.5px", fontWeight: 700, letterSpacing: "0.8px" }}>
              ADM-DEV
            </span>
          )}
        </button>

        <button
          onClick={() => setIsLgpdOpen(true)}
          title="Ver conformidade com a LGPD"
          style={{
            background: t.surfaceAlt,
            border: `1.5px solid ${t.border}`,
            borderRadius: 11,
            padding: "8px 11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.22s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
        >
          <ShieldCheck size={18} color="#22c55e" />
          <span style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSub }}>LGPD</span>
        </button>
      </div>

      {/* Theme Toggle */}
      <button
        onClick={onToggleTheme}
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          background: t.surfaceAlt,
          border: `1.5px solid ${t.border}`,
          borderRadius: 9,
          padding: "8px 11px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: t.textSub,
          fontSize: "12.5px",
          fontFamily: "inherit"
        }}
      >
        {mode === "dark" ? <Sun size={15} color={t.textSub} /> : <Moon size={15} color={t.textSub} />}
        {mode === "dark" ? "Claro" : "Escuro"}
      </button>

      {/* Mini Relógio Sincronizado Brasília */}
      <div
        onClick={() => setTriggerSync(prev => prev + 1)}
        title="Clique para sincronizar o horário novamente"
        style={{
          position: "absolute",
          top: 66,
          right: 18,
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 2,
          boxShadow: t.shadow,
          zIndex: 10,
          minWidth: 140,
          textAlign: "right",
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.2s ease-in-out"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.03)";
          e.currentTarget.style.borderColor = t.accent;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.borderColor = t.border;
        }}
      >
        <span style={{ fontSize: "10px", color: t.textSub, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={11} color={t.accent} /> Brasília
        </span>
        <span style={{ fontSize: "20px", fontWeight: 800, color: t.text, fontFamily: "monospace", letterSpacing: "-0.5px", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
          {timeStr}
        </span>
        <span style={{ fontSize: "10.5px", color: t.textMuted, fontWeight: 500 }}>
          {dateStr}
        </span>
        
        {/* Status Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <span style={{ position: "relative", display: "flex", height: 6, width: 6 }}>
            {clockStatus === "synced" && (
              <span className="animate-ping" style={{ position: "absolute", inlineSize: "100%", blockSize: "100%", borderRadius: "50%", background: "#4ade80", opacity: 0.75 }}></span>
            )}
            <span style={{ position: "relative", inlineSize: 6, blockSize: 6, borderRadius: "50%", background: clockStatus === "synced" ? "#22c55e" : clockStatus === "syncing" ? "#3b82f6" : "#f59e0b" }}></span>
          </span>
          <span style={{ fontSize: "9px", fontWeight: 600, color: clockStatus === "synced" ? "#16a34a" : clockStatus === "syncing" ? "#2563eb" : "#d97706" }}>
            {clockStatus === "synced" ? "Hora Segura" : clockStatus === "syncing" ? "Sincronizando" : "⚠️ Gravado Offline (Aguardando Rede)"}
          </span>
        </div>
      </div>

      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 20,
          padding: "44px 40px",
          width: "100%",
          maxWidth: 400,
          boxShadow: t.shadow,
          zIndex: 1
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: isAdminMode ? `linear-gradient(135deg, ${t.accent}, #2040CC)` : t.surfaceAlt,
              border: `1.5px solid ${isAdminMode ? "transparent" : t.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
              boxShadow: isAdminMode ? `0 8px 28px ${t.accentGlow}` : "none"
            }}
          >
            {isAdminMode ? (
              <Shield size={28} color="#fff" fill="none" />
            ) : (
              <Lock size={26} color={t.accent} />
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: t.text, letterSpacing: "-0.3px" }}>
            {isAdminMode ? "Acesso ADM-Dev" : "Controle de Ponto"}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: t.textSub }}>
            {isAdminMode ? "Painel restrito — credenciais administrativas" : "Entre com sua matrícula e senha"}
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: "11.5px",
              fontWeight: 700,
              color: t.textSub,
              marginBottom: 6,
              letterSpacing: "0.5px",
              textTransform: "uppercase"
            }}
          >
            Matrícula
          </label>
          <input
            type="text"
            placeholder={isAdminMode ? "Ex: ADM001" : "Ex: 100100 ou 200100"}
            value={mat}
            onChange={e => {
              setMat(e.target.value);
              setError("");
            }}
            onFocus={() => setFocused("mat")}
            onBlur={() => setFocused(null)}
            style={inputSt("mat")}
            onKeyDown={e => e.key === "Enter" && submit()}
          />
        </div>

        <div style={{ marginBottom: 6 }}>
          <label
            style={{
              display: "block",
              fontSize: "11.5px",
              fontWeight: 700,
              color: t.textSub,
              marginBottom: 6,
              letterSpacing: "0.5px",
              textTransform: "uppercase"
            }}
          >
            Senha
          </label>
          <PwInput value={pw} onChange={setPw} placeholder={isAdminMode ? "Senha ADM-Dev" : "Senha"} t={t} />
        </div>

        {error && (
          <div
            style={{
              background: t.dangerBg,
              border: `1.5px solid ${t.dangerBorder}`,
              borderRadius: 8,
              padding: "9px 13px",
              marginBottom: 14,
              color: t.danger,
              fontSize: 13,
              marginTop: 10
            }}
          >
            {error}
          </div>
        )}

        <Btn onClick={submit} t={t} disabled={loading} style={{ width: "100%", marginTop: 14 }}>
          {loading ? "Verificando..." : isAdminMode ? "Entrar como ADM-Dev" : "Entrar"}
        </Btn>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1.5px solid ${t.border}`, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
            Problemas de acesso? Fale com o <span style={{ color: t.accent, cursor: "pointer" }}>administrador</span>
          </p>
        </div>
        <div 
          onClick={() => setIsLgpdOpen(true)}
          title="Clique para ver a conformidade com a LGPD"
          style={{ 
            marginTop: 12, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: 6,
            cursor: "pointer",
            opacity: 0.85,
            transition: "opacity 0.2s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.85"; }}
        >
          <Shield size={11} color="#22c55e" />
          <span style={{ fontSize: 11, color: t.textSub, textDecoration: "underline", decorationStyle: "dotted" }}>
            Dados protegidos conforme LGPD
          </span>
        </div>
      </div>

      <LgpdModal isOpen={isLgpdOpen} onClose={() => setIsLgpdOpen(false)} t={t} />
    </div>
  );
}
