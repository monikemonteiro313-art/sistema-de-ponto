import React, { useState, useEffect } from "react";
import { Check, Calendar, Clock, Unlock, Shield, SquarePen, ShieldCheck } from "lucide-react";
import { ThemeColors, User, Batida, DiaPontos, PontosGlobal } from "../types";
import { getOverlapWithNightShift } from "../utils/hrHelpers";
import { LgpdModal } from "./LgpdModal";

interface EmployeePanelProps {
  t: ThemeColors;
  currentUser: User;
  onLogout: () => void;
  pontosGlobal: PontosGlobal;
  setPontosGlobal: React.Dispatch<React.SetStateAction<PontosGlobal>>;
  onAddLog: (acao: string, alvo: string, detalhe?: string) => void;
  feriados?: string[];
}

export function EmployeePanel({ t, currentUser, onLogout, pontosGlobal, setPontosGlobal, onAddLog, feriados = [] }: EmployeePanelProps) {
  const [now, setNow] = useState(new Date());
  const [isLgpdOpen, setIsLgpdOpen] = useState(false);

  // Safe Monotonic NTP-like Clock Sync states
  const [baseRealTime, setBaseRealTime] = useState<number | null>(null);
  const [basePerfTime, setBasePerfTime] = useState<number | null>(null);
  const [clockStatus, setClockStatus] = useState<"syncing" | "synced" | "local">("syncing");
  const [triggerSync, setTriggerSync] = useState(0);

  const getSyncDate = () => {
    if (baseRealTime !== null && basePerfTime !== null) {
      const elapsed = performance.now() - basePerfTime;
      return new Date(baseRealTime + elapsed);
    }
    return new Date();
  };

  const todayKey = () => {
    const syncDate = getSyncDate();
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      const parts = formatter.formatToParts(syncDate);
      const year = parts.find(p => p.type === "year")?.value;
      const month = parts.find(p => p.type === "month")?.value;
      const day = parts.find(p => p.type === "day")?.value;
      return `${year}-${month}-${day}`;
    } catch (e) {
      return syncDate.toISOString().slice(0, 10);
    }
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
              console.log(`[Clock Sync] Sucesso usando ${url}. RTT: ${rtt.toFixed(1)}ms.`);
              return;
            }
          }
        } catch (e) {
          console.warn(`[Clock Sync] Falha ao sincronizar com ${url}:`, e);
        }
      }

      if (active) {
        console.warn("[Clock Sync] Todos os serviços de horário falharam. Usando relógio local.");
        setBaseRealTime(Date.now());
        setBasePerfTime(performance.now());
        setClockStatus("local");
      }
    }

    syncTime();

    return () => {
      active = false;
    };
  }, [triggerSync]);

  // UI state
  const [confirmModal, setConfirmModal] = useState<{ idx: number; dayKey: string } | null>(null);
  const [manualModal, setManualModal] = useState<{ idx: number; dayKey: string } | null>(null);
  const [manualHora, setManualHora] = useState("");
  const [manualJust, setManualJust] = useState("");
  const [manualError, setManualError] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [calDay, setCalDay] = useState<string | null>(null);

  // Geoloc states
  const [geoActiveFor, setGeoActiveFor] = useState<{
    idx: number;
    dayKey: string;
    tipo: "auto" | "manual";
    manualHora?: string;
    manualJust?: string;
  } | null>(null);

  const [geoConsentAccepted, setGeoConsentAccepted] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Progressive accuracy filter states
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);
  const [geoIntervalId, setGeoIntervalId] = useState<any | null>(null);
  const [geoCountdown, setGeoCountdown] = useState<number>(0);
  const [geoSamplesCount, setGeoSamplesCount] = useState<number>(0);
  const [bestGeoCoords, setBestGeoCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);

  function clearGeo() {
    setGeoConsentAccepted(false);
    setGeoCoords(null);
    setBestGeoCoords(null);
    setGeoLoading(false);
    setGeoError(null);
    setGeoSamplesCount(0);
    setGeoCountdown(0);
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      setGeoWatchId(null);
    }
    if (geoIntervalId !== null) {
      clearInterval(geoIntervalId);
      setGeoIntervalId(null);
    }
  }

  // Auto clean up watch and timers on unmount
  useEffect(() => {
    return () => {
      if (geoWatchId !== null) {
        navigator.geolocation.clearWatch(geoWatchId);
      }
      if (geoIntervalId !== null) {
        clearInterval(geoIntervalId);
      }
    };
  }, [geoWatchId, geoIntervalId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(getSyncDate());
    }, 1000);
    return () => clearInterval(timer);
  }, [baseRealTime, basePerfTime]);

  const tk = todayKey();
  const todayBatidas = pontosGlobal[currentUser.id]?.[tk] || [null, null, null, null];
  const temAlmoco = todayBatidas[1] !== null;

  const steps = [
    { label: "Registrar Entrada", done: "Entrada", color: "#22C55E", light: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)" },
    { label: "Saída para Almoço", done: "Almoço", color: "#F59E0B", light: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)" },
    { label: "Retorno do Almoço", done: "Volta", color: "#3B82F6", light: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)" },
    { 
      label: temAlmoco ? "Encerrar Expediente" : "Saída Sem Almoço", 
      done: temAlmoco ? "Saída" : "Saída Sem Almoço", 
      color: "#EF4444", 
      light: "rgba(239,68,68,0.12)", 
      border: "rgba(239,68,68,0.35)" 
    }
  ];

  const nextIdx = todayBatidas.findIndex(b => b === null);
  const allDone = todayBatidas[3] !== null || nextIdx === -1;
  const current = allDone ? null : steps[nextIdx];

  function isStepClickable(i: number): boolean {
    if (allDone) return false;
    if (i === 0) {
      return todayBatidas[0] === null;
    }
    if (i === 1) {
      return todayBatidas[0] !== null && todayBatidas[1] === null;
    }
    if (i === 2) {
      return todayBatidas[1] !== null && todayBatidas[2] === null;
    }
    if (i === 3) {
      if (todayBatidas[1] === null) {
        return todayBatidas[0] !== null && todayBatidas[3] === null;
      } else {
        return todayBatidas[2] !== null && todayBatidas[3] === null;
      }
    }
    return false;
  }

  function calcHoras(batidas: DiaPontos): string | null {
    const [e, sA, rA, s] = batidas.map(b => (b && b.hora && !b.duplicadoOculto ? new Date(b.hora) : null));
    if (!e) return null;
    const fim = s || now;
    let ms = fim.getTime() - e.getTime();
    if (sA && rA) {
      ms -= rA.getTime() - sA.getTime();
    } else if (sA && !rA) {
      ms -= now.getTime() - sA.getTime();
    }
    if (ms < 0) ms = 0;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${String(m).padStart(2, "0")}min`;
  }

  function capturarLocalizacao() {
    setGeoLoading(true);
    setGeoError(null);
    setGeoConsentAccepted(true);
    setGeoSamplesCount(0);
    setBestGeoCoords(null);
    setGeoCoords(null);

    if (!navigator.geolocation) {
      setGeoError("Geolocalização não é suportada por este navegador.");
      setGeoLoading(false);
      return;
    }

    let bestCoords: { latitude: number; longitude: number; accuracy?: number } | null = null;
    let samples = 0;
    let watchId: number | null = null;
    let intervalId: any = null;

    const totalDuration = 7;
    setGeoCountdown(totalDuration);

    function stopAndSelectBest(wId: number, coords: typeof bestCoords) {
      if (wId !== null) {
        navigator.geolocation.clearWatch(wId);
      }
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      setGeoWatchId(null);
      setGeoIntervalId(null);
      setGeoLoading(false);
      setGeoCountdown(0);
      
      if (coords) {
        setGeoCoords(coords);
        setBestGeoCoords(coords);
      } else {
        // Fallback to rapid single query if watch did not return anything
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const finalCoords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            };
            setGeoCoords(finalCoords);
            setBestGeoCoords(finalCoords);
          },
          (err) => {
            setGeoError("Tempo limite atingido e nenhum sinal de geolocalização válido foi recebido.");
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          samples++;
          setGeoSamplesCount(samples);
          const curAcc = position.coords.accuracy;
          const newCoords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: curAcc
          };

          if (!bestCoords || (curAcc !== undefined && (bestCoords.accuracy === undefined || curAcc < bestCoords.accuracy))) {
            bestCoords = newCoords;
            setBestGeoCoords(newCoords);
            setGeoCoords(newCoords);
          }

          // If accuracy is extremely high (under 6m), stop warming up early
          if (curAcc !== undefined && curAcc <= 6) {
            stopAndSelectBest(watchId!, bestCoords);
          }
        },
        (error) => {
          console.error("Localizacao erro no watchPosition:", error);
          if (bestCoords) {
            stopAndSelectBest(watchId!, bestCoords);
            return;
          }

          let msg = "Não foi possível obter a sua localização.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Acesso à geolocalização negado. Por favor, ative a permissão de localização do seu dispositivo ou navegador.";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = "Sinal de localização indisponível. Verifique a recepção ou o GPS e tente novamente.";
          } else if (error.code === error.TIMEOUT) {
            msg = "Tempo limite atingido. Certifique-se de que o GPS está ativo e tente novamente.";
          }
          setGeoError(msg);
          setGeoLoading(false);
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          if (intervalId !== null) clearInterval(intervalId);
        },
        options
      );

      setGeoWatchId(watchId);

      let remaining = totalDuration;
      intervalId = setInterval(() => {
        remaining--;
        setGeoCountdown(remaining);
        if (remaining <= 0) {
          stopAndSelectBest(watchId!, bestCoords);
        }
      }, 1000);

      setGeoIntervalId(intervalId);
    } catch (e) {
      console.error(e);
      setGeoError("Erro ao iniciar o watchPosition de geolocalização.");
      setGeoLoading(false);
    }
  }

  function finalizarComGeo() {
    if (!geoActiveFor) return;
    const { idx, dayKey, tipo, manualHora, manualJust } = geoActiveFor;
    const lat = geoCoords?.latitude || undefined;
    const lng = geoCoords?.longitude || undefined;
    const acc = geoCoords?.accuracy !== undefined ? geoCoords.accuracy : undefined;
    const timestamp = getSyncDate().toISOString();

    const isOffline = clockStatus === "local";

    if (tipo === "auto") {
      const reg: Batida = {
        hora: timestamp,
        tipo: "auto",
        registradoEm: timestamp,
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        consentimentoGeoloc: true,
        dispositivoLocalHora: new Date().toISOString(),
        gravadoOffline: isOffline ? true : undefined
      };
      setPontosGlobal(prev => {
        const userRegs = prev[currentUser.id] || {};
        const day = [...(userRegs[dayKey] || [null, null, null, null])];
        day[idx] = reg;
        return {
          ...prev,
          [currentUser.id]: {
            ...userRegs,
            [dayKey]: day
          }
        };
      });
      onAddLog(
        isOffline ? "Registrou Ponto Offline" : "Registrou Ponto",
        `${currentUser.nome} (${currentUser.matricula})`,
        `Batida #${idx + 1} (${steps[idx].done}) registrada às ${new Date(timestamp).toLocaleTimeString()} com Geolocalização${isOffline ? " [MODO OFFLINE]" : ""}. Coordenadas: Lat: ${lat || "N/D"}, Long: ${lng || "N/D"}${acc !== undefined ? ` (Precisão: ${acc.toFixed(1)}m)` : ""}. Termo de consentimento aceito.`
      );
    } else {
      const d = new Date(dayKey + "T00:00:00");
      if (manualHora) {
        const [hh, mm] = manualHora.split(":").map(Number);
        d.setHours(hh, mm, 0, 0);
      }
      const reg: Batida = {
        hora: d.toISOString(),
        tipo: "manual",
        obs: manualJust?.trim(),
        registradoEm: timestamp,
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        consentimentoGeoloc: true,
        dispositivoLocalHora: new Date().toISOString(),
        gravadoOffline: isOffline ? true : undefined
      };
      setPontosGlobal(prev => {
        const userRegs = prev[currentUser.id] || {};
        const day = [...(userRegs[dayKey] || [null, null, null, null])];
        day[idx] = reg;
        return {
          ...prev,
          [currentUser.id]: {
            ...userRegs,
            [dayKey]: day
          }
        };
      });
      onAddLog(
        isOffline ? "Inseriu Ponto Manual Offline" : "Inseriu Ponto Manual",
        `${currentUser.nome} (${currentUser.matricula})`,
        `Dia ${dayKey} às ${manualHora} (Batida #${idx + 1}): "${manualJust?.trim()}" inserido com Geolocalização${isOffline ? " [MODO OFFLINE]" : ""}. Coordenadas: Lat: ${lat || "N/D"}, Long: ${lng || "N/D"}${acc !== undefined ? ` (Precisão: ${acc.toFixed(1)}m)` : ""}. Termo de consentimento aceito.`
      );
    }

    setGeoActiveFor(null);
    clearGeo();
  }

  function registrarAgora(idx: number, dayKey: string) {
    setGeoActiveFor({ idx, dayKey, tipo: "auto" });
    setConfirmModal(null);
    clearGeo();
  }

  function iniciarManualComGeo() {
    if (!manualHora.match(/^\d{2}:\d{2}$/)) {
      setManualError("Informe HH:MM.");
      return;
    }
    const [hh, mm] = manualHora.split(":").map(Number);
    if (hh > 23 || mm > 59) {
      setManualError("Horário inválido.");
      return;
    }
    if (!manualModal) return;
    setGeoActiveFor({
      idx: manualModal.idx,
      dayKey: manualModal.dayKey,
      tipo: "manual",
      manualHora,
      manualJust: manualJust.trim()
    });
    setManualModal(null);
    clearGeo();
  }

  function confirmarManual() {
    iniciarManualComGeo();
  }

  function abrirConfirm(idx: number, dayKey: string) {
    setConfirmModal({ idx, dayKey });
  }

  function abrirManual(idx: number, dayKey: string) {
    let h = "";
    let m = "";
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      h = parts.find(p => p.type === "hour")?.value || "12";
      m = parts.find(p => p.type === "minute")?.value || "00";
    } catch {
      h = String(now.getHours()).padStart(2, "0");
      m = String(now.getMinutes()).padStart(2, "0");
    }
    setManualHora(`${h}:${m}`);
    setManualJust("");
    setManualError("");
    setManualModal({ idx, dayKey });
    setConfirmModal(null);
  }

  function fmt(batida: Batida | null) {
    if (!batida || !batida.hora) return "—";
    return new Date(batida.hora).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  }

  function fmtFull(dateStr: string | undefined) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function getLast30Days() {
    const days = [];
    const baseDate = getSyncDate();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(baseDate.getTime());
      d.setDate(d.getDate() - i);
      try {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        });
        const parts = formatter.formatToParts(d);
        const year = parts.find(p => p.type === "year")?.value;
        const month = parts.find(p => p.type === "month")?.value;
        const day = parts.find(p => p.type === "day")?.value;
        days.push(`${year}-${month}-${day}`);
      } catch {
        days.push(d.toISOString().slice(0, 10));
      }
    }
    return days;
  }

  function dayLabel(key: string) {
    const d = new Date(key + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  function dayStatus(key: string) {
    const userFerias = currentUser.ferias || [];
    const eFerias = userFerias.some(p => key >= p.inicio && key <= p.fim);
    if (eFerias) return "ferias";

    if (feriados.includes(key)) return "feriado";

    const b = pontosGlobal[currentUser.id]?.[key];
    if (!b) return "vazio";
    const filled = b.filter(Boolean).length;
    if (filled === 0) return "vazio";
    if (filled === 4) return "completo";
    return "parcial";
  }

  function isToday(key: string) {
    return key === todayKey();
  }

  const firstName = currentUser?.nome?.split(" ")[0] || "Colaboradora";
  const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long" });
  const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const btnColor = allDone ? "#22C55E" : (current?.color || "#3B6EF8");
  const btnLight = allDone ? "rgba(34,197,94,0.13)" : (current?.light || "rgba(59,110,248,0.15)");
  const btnBorder = allDone ? "rgba(34,197,94,0.35)" : (current?.border || "rgba(59,110,248,0.35)");

  const nightShiftLast30 = getLast30Days().reduce((acc, key) => {
    const batidas = pontosGlobal[currentUser.id]?.[key];
    if (!batidas || batidas[0] === null) return acc;
    const [e, sA, rA, s] = batidas.map(b => (b && b.hora ? new Date(b.hora) : null));
    if (!e) return acc;
    const listOverlaps = [];
    if (sA) {
      listOverlaps.push(...getOverlapWithNightShift(e, sA));
      if (rA && s) {
        listOverlaps.push(...getOverlapWithNightShift(rA, s));
      }
    } else if (s) {
      listOverlaps.push(...getOverlapWithNightShift(e, s));
    }
    const h = listOverlaps.reduce((sum, o) => sum + o.horas, 0);
    if (h > 0) {
      acc.dias++;
      acc.horas += h;
    }
    return acc;
  }, { dias: 0, horas: 0 });

  const calBatidas = calDay ? pontosGlobal[currentUser.id]?.[calDay] || [null, null, null, null] : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "'DM Sans','Segoe UI',sans-serif"
      }}
    >
      {/* Top Header */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => {
              setCalOpen(v => !v);
              setCalDay(null);
            }}
            title="Histórico de pontos"
            style={{
              background: calOpen ? t.accent : t.surfaceAlt,
              border: `1.5px solid ${calOpen ? t.accent : t.border}`,
              borderRadius: 10,
              padding: "8px 9px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: calOpen ? `0 0 14px ${t.accentGlow}` : "none",
              transition: "all 0.2s"
            }}
          >
            <Calendar size={19} color={calOpen ? "#fff" : t.accent} />
          </button>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>Olá, {firstName}! 👋</div>
            <div style={{ fontSize: "12.5px", color: t.textSub, marginTop: 2, textTransform: "capitalize" }}>{dateStr}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: t.surfaceAlt,
            border: `1px solid ${t.border}`,
            borderRadius: 9,
            padding: "7px 13px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: t.textSub,
            fontFamily: "inherit"
          }}
        >
          Sair
        </button>
      </div>

      {/* Expandable History Calendar */}
      {calOpen && (
        <div style={{ width: "100%", maxWidth: 420, background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 16, padding: "18px 16px", marginBottom: 20, boxShadow: t.shadow }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, marginBottom: 14, letterSpacing: "0.4px", textTransform: "uppercase" }}>
            Últimos 30 dias
          </div>

          {nightShiftLast30.horas > 0 && (
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: t.textSub, fontWeight: 550 }}>🌙 Adicional Noturno (Últimos 30 dias)</span>
              <strong style={{ fontSize: 13, color: "#D97706", fontFamily: "monospace" }}>
                {nightShiftLast30.dias} {nightShiftLast30.dias === 1 ? "dia" : "dias"} ({nightShiftLast30.horas.toFixed(1).replace(".", ",")}h)
              </strong>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: calDay ? 16 : 0 }}>
            {getLast30Days().map(key => {
              const st = dayStatus(key);
              const today = isToday(key);
              const sel = calDay === key;

              const eFerias = st === "ferias";
              const eFeriado = st === "feriado";

              const bg = sel
                ? t.accent
                : today
                  ? t.accentGlow
                  : eFerias
                    ? "rgba(124,58,237,0.13)"
                    : eFeriado
                      ? "rgba(223,34,34,0.11)"
                      : st === "completo"
                        ? "rgba(34,197,94,0.15)"
                        : st === "parcial"
                          ? "rgba(245,158,11,0.13)"
                          : t.surfaceAlt;

              const border = sel
                ? t.accent
                : today
                  ? t.accent
                  : eFerias
                    ? "rgba(124,58,237,0.35)"
                    : eFeriado
                      ? "rgba(223,34,34,0.35)"
                      : st === "completo"
                        ? "rgba(34,197,94,0.4)"
                        : st === "parcial"
                          ? "rgba(245,158,11,0.4)"
                          : t.border;

              const color = sel
                ? "#fff"
                : today
                  ? t.accent
                  : eFerias
                    ? "#7C3AED"
                    : eFeriado
                      ? "#DF2222"
                      : st === "completo"
                        ? "#22C55E"
                        : st === "parcial"
                          ? "#F59E0B"
                          : t.textMuted;

              return (
                <button
                  key={key}
                  onClick={() => setCalDay(sel ? null : key)}
                  style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 8, padding: "6px 2px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.18s" }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color, textAlign: "center", lineHeight: 1.3 }}>
                    {new Date(key + "T12:00:00").getDate()}
                  </div>
                  <div style={{ fontSize: 9, color: sel ? "rgba(255,255,255,0.7)" : t.textMuted, textAlign: "center" }}>
                    {new Date(key + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" })}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 2, fontSize: 8, fontWeight: "bold", color }}>
                    {eFerias ? "✈️" : eFeriado ? "🎉" : st === "completo" ? "✓" : st === "parcial" ? "~" : "·"}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {[
              ["rgba(34,197,94,0.15)", "rgba(34,197,94,0.4)", "Completo"],
              ["rgba(245,158,11,0.13)", "rgba(245,158,11,0.4)", "Parcial"],
              ["rgba(124,58,237,0.13)", "rgba(124,58,237,0.35)", "Férias"],
              ["rgba(223,34,34,0.11)", "rgba(223,34,34,0.35)", "Feriado"],
              [null, null, "Sem registro"]
            ].map(([bg, brd, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: bg || t.surfaceAlt, border: `1.5px solid ${brd || t.border}` }} />
                <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Selected Day details */}
          {calDay && calBatidas && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                    {dayLabel(calDay)}
                    {isToday(calDay) ? " — Hoje" : ""}
                  </div>
                  {dayStatus(calDay) === "ferias" && (
                    <div style={{ color: "#7C3AED", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.22)", fontSize: 11, padding: "5px 10px", borderRadius: 8, marginTop: 6, fontWeight: 600 }}>
                      ✈️ Férias Programadas. Sem expediente nesta data.
                    </div>
                  )}
                  {dayStatus(calDay) === "feriado" && (
                    <div style={{ color: "#DF2222", background: "rgba(223,34,34,0.06)", border: "1px solid rgba(223,34,34,0.18)", fontSize: 11, padding: "5px 10px", borderRadius: 8, marginTop: 6, fontWeight: 600 }}>
                      🎉 Feriado Corporativo. Abono e folga geral.
                    </div>
                  )}
                  {calBatidas.some(b => b && b.pendenteJustificativa) && (
                    <div style={{ color: "#D97706", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 11.5, padding: "8px 12px", borderRadius: 10, marginTop: 6, fontWeight: 600 }}>
                      ⚠️ <strong>Atenção:</strong> Batida Ímpar (Ponto Órfão) identificada. 
                      O Cérebro de Autocura sinalizou este dia como pendente. Por favor, regularize este dia inserindo a batida faltante e informando a justificativa.
                    </div>
                  )}
                </div>
              </div>
              {steps.map((s, i) => {
                const batida = calBatidas[i];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: batida ? s.color : t.surfaceAlt,
                          border: `2px solid ${batida ? s.color : t.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}
                      >
                        {batida ? <Check size={12} color="#fff" /> : <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.border }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: batida ? 600 : 400, color: batida ? t.text : t.textMuted }}>{s.done}</div>
                        {batida?.tipo === "manual" && (
                          <div style={{ fontSize: 10, color: "#F59E0B", marginTop: 1 }}>
                            MANUAL · reg. {fmtFull(batida.registradoEm)}
                            {batida.obs ? ` · "${batida.obs}"` : ""}
                            {batida.suspeitoHoraModificada && <span style={{ color: t.danger, fontWeight: 700, marginLeft: 6 }}>[⚠️ Suspeito - Hora Modificada]</span>}
                            {batida.gravadoOffline && <span style={{ color: "#D97706", fontWeight: 700, marginLeft: 6 }}>[⚠️ Gravado Offline]</span>}
                          </div>
                        )}
                        {batida?.tipo === "auto" && (
                          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 1 }}>
                            {batida.suspeitoHoraModificada && <span style={{ color: t.danger, fontWeight: 700 }}>[⚠️ Suspeito - Hora Modificada] </span>}
                            {batida.gravadoOffline && <span style={{ color: "#D97706", fontWeight: 700 }}>[⚠️ Gravado Offline (Aguardando Rede)] </span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: batida ? s.color : t.textMuted }}>{fmt(batida)}</span>
                      {!batida && (
                        <button
                          onClick={() => abrirManual(i, calDay)}
                          title="Inserir horário"
                          style={{
                            background: t.surfaceAlt,
                            border: `1.5px solid ${t.border}`,
                            borderRadius: 7,
                            padding: "4px 8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontFamily: "inherit",
                            fontSize: 12,
                            color: t.textSub,
                            fontWeight: 600
                          }}
                        >
                          <SquarePen size={12} />
                          Inserir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {calcHoras(calBatidas) && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <span style={{ fontSize: 13, color: t.textSub }}>Total do dia</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>{calcHoras(calBatidas)}</span>
                </div>
              )}
              {calDay && calBatidas && (() => {
                const [e, sA, rA, s] = calBatidas.map(b => (b && b.hora ? new Date(b.hora) : null));
                if (!e) return null;
                const listOverlaps = [];
                if (sA) {
                  listOverlaps.push(...getOverlapWithNightShift(e, sA));
                  if (rA && s) {
                    listOverlaps.push(...getOverlapWithNightShift(rA, s));
                  }
                } else if (s) {
                  listOverlaps.push(...getOverlapWithNightShift(e, s));
                }
                const h = listOverlaps.reduce((sum, o) => sum + o.horas, 0);
                if (h > 0) {
                  const parts = listOverlaps.map(o => `${o.textoIntervalo}`);
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 10, padding: "8px 10px", background: "rgba(245,158,11,0.06)", border: "1.5px dashed rgba(245,158,11,0.3)", borderRadius: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12.5, color: "#D97706", fontWeight: 700 }}>🌙 Adicional Noturno</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#D97706", fontFamily: "monospace" }}>
                          {h.toFixed(1).replace(".", ",")}h
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>
                        Período: {parts.join(", ")}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
      )}

      {/* Clock Face with Sync Status */}
      <div style={{ marginBottom: 24, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: "-2px", color: t.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {timeStr}
        </div>
        
        <div 
          onClick={() => setTriggerSync(prev => prev + 1)}
          title="Clique para sincronizar o horário novamente"
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 6, 
            padding: "5px 12px", 
            borderRadius: 20, 
            background: clockStatus === "synced" ? "rgba(34,197,94,0.08)" : clockStatus === "syncing" ? "rgba(59,130,246,0.08)" : "rgba(245,158,11,0.08)",
            border: `1px solid ${clockStatus === "synced" ? "rgba(34,197,94,0.25)" : clockStatus === "syncing" ? "rgba(59,130,246,0.25)" : "rgba(245,158,11,0.25)"}`,
            fontSize: 11,
            color: clockStatus === "synced" ? "#16a34a" : clockStatus === "syncing" ? "#2563eb" : "#d97706",
            fontWeight: 600,
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            userSelect: "none"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.03)";
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.opacity = "1";
          }}
        >
          {clockStatus === "synced" ? (
            <>
              <span style={{ position: "relative", display: "flex", height: 8, width: 8 }}>
                <span className="animate-ping" style={{ position: "absolute", inlineSize: "100%", blockSize: "100%", borderRadius: "50%", background: "#4ade80", opacity: 0.75 }}></span>
                <span style={{ position: "relative", inlineSize: 8, blockSize: 8, borderRadius: "50%", background: "#22c55e" }}></span>
              </span>
              🛰️ Horário Seguro de Brasília (Sincronizado)
            </>
          ) : clockStatus === "syncing" ? (
            <>
              <div className="animate-spin" style={{ width: 10, height: 10, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%" }} />
              Sincronizando com relógio atômico...
            </>
          ) : (
            <>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#d97706" }} />
              ⚠️ Gravado Offline (Aguardando Rede)
            </>
          )}
        </div>
      </div>

      {/* Gauge and Button Trigger */}
      {!calOpen && (
        <div style={{ marginBottom: 24, width: "100%", maxWidth: 380, textAlign: "center" }}>
          {allDone ? (
            <div style={{ background: btnLight, border: `2.5px solid ${btnBorder}`, borderRadius: 20, padding: "28px 24px" }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
              <div style={{ fontSize: 21, fontWeight: 700, color: btnColor }}>Expediente encerrado!</div>
              <div style={{ fontSize: 13, color: t.textSub, marginTop: 5 }}>Bom descanso, {firstName}!</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 3 }}>
                Seu total de hoje: <strong style={{ color: t.text }}>{calcHoras(todayBatidas)}</strong>
              </div>
            </div>
          ) : todayBatidas[0] !== null && todayBatidas[1] === null ? (
            /* Special state: Antes do almoço. Show both option buttons stacked! */
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
              <button
                onClick={() => abrirConfirm(1, tk)}
                style={{
                  width: "100%",
                  border: `2px solid ${steps[1].border}`,
                  borderRadius: 16,
                  padding: "16px 20px",
                  background: `linear-gradient(160deg, ${steps[1].light}, ${steps[1].color}12)`,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontFamily: "inherit",
                  boxShadow: `0 4px 12px ${steps[1].color}15`,
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: steps[1].color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${steps[1].color}44` }}>
                    <Clock size={18} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: steps[1].color }}>
                      {steps[1].label}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>Seguir com o fluxo normal de almoço</div>
                  </div>
                </div>
                <span style={{ fontSize: 18, color: steps[1].color }}>➔</span>
              </button>

              <button
                onClick={() => abrirConfirm(3, tk)}
                style={{
                  width: "100%",
                  border: `2px solid ${steps[3].border}`,
                  borderRadius: 16,
                  padding: "16px 20px",
                  background: `linear-gradient(160deg, ${steps[3].light}, ${steps[3].color}12)`,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontFamily: "inherit",
                  boxShadow: `0 4px 12px ${steps[3].color}15`,
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: steps[3].color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${steps[3].color}44` }}>
                    <Clock size={18} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: steps[3].color }}>
                      {steps[3].label}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>Encerrar hoje direto sem almoço</div>
                  </div>
                </div>
                <span style={{ fontSize: 18, color: steps[3].color }}>➔</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => abrirConfirm(nextIdx, tk)}
              style={{
                width: "100%",
                border: `2.5px solid ${btnBorder}`,
                borderRadius: 20,
                padding: "28px 24px",
                background: `linear-gradient(160deg, ${btnLight}, ${btnColor}18)`,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "inherit",
                boxShadow: `0 8px 32px ${btnColor}30`
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    background: btnColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                    boxShadow: `0 4px 16px ${btnColor}55`
                  }}
                >
                  <Clock size={26} color="white" />
                </div>
                <div style={{ fontSize: 21, fontWeight: 800, color: btnColor, letterSpacing: "-0.3px" }}>
                  {current?.label}
                </div>
                <div style={{ fontSize: 13, color: t.textSub }}>Toque aqui para registrar</div>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Today's Registrations log */}
      {!calOpen && (
        <div style={{ width: "100%", maxWidth: 380, background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 16, padding: "6px 8px", marginBottom: 14 }}>
          {steps.map((s, i) => {
            const batida = todayBatidas[i];
            const isNext = !allDone && nextIdx === i;
            const clickable = isStepClickable(i);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: clickable ? `${s.color}0D` : isNext ? `${s.color}08` : "transparent",
                  border: clickable ? `1px dashed ${s.color}60` : "1px solid transparent",
                  cursor: clickable ? "pointer" : "default",
                  transition: "all 0.15s ease",
                  marginBottom: 4
                }}
                onClick={clickable ? () => abrirConfirm(i, tk) : undefined}
                title={clickable ? `Clique para registrar: ${s.label}` : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: batida ? s.color : clickable ? `${s.color}1c` : isNext ? `${s.color}22` : t.surfaceAlt,
                      border: `2px solid ${batida ? s.color : clickable ? s.color : isNext ? s.color : t.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: clickable ? `0 0 8px ${s.color}33` : "none"
                    }}
                  >
                    {batida ? (
                      <Check size={13} color="#fff" />
                    ) : clickable ? (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} className="animate-pulse" />
                    ) : isNext ? (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
                    ) : (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: t.border }} />
                    )}
                  </div>
                  <div>
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: batida || isNext || clickable ? 600 : 400, 
                      color: batida || isNext || clickable ? t.text : t.textMuted,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}>
                      {s.done}
                      {clickable && (
                        <span style={{ fontSize: 9, color: s.color, background: `${s.color}15`, padding: "1px 5px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                          Clicável
                        </span>
                      )}
                    </div>
                    {batida?.tipo === "manual" && <div style={{ fontSize: 10, color: "#F59E0B" }}>MANUAL · reg. {fmtFull(batida.registradoEm)}</div>}
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: batida ? s.color : clickable ? s.color : t.textMuted }}>
                  {batida ? fmt(batida) : clickable ? "➔" : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!calOpen && calcHoras(todayBatidas) && (
        <div style={{ width: "100%", maxWidth: 380, background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "11px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13.5px", color: t.textSub }}>Horas trabalhadas hoje</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>{calcHoras(todayBatidas)}</span>
        </div>
      )}

      {/* LGPD footnote */}
      <div 
        onClick={() => setIsLgpdOpen(true)}
        title="Clique para ver a conformidade com a LGPD"
        style={{ 
          marginTop: 22, 
          display: "flex", 
          alignItems: "center", 
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

      <LgpdModal isOpen={isLgpdOpen} onClose={() => setIsLgpdOpen(false)} t={t} />

      {/* Confirmation modal */}
      {confirmModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 500,
            padding: 20
          }}
          onClick={() => setConfirmModal(null)}
        >
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 20,
              padding: "32px 28px",
              width: "100%",
              maxWidth: 360,
              boxShadow: t.shadow
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: steps[confirmModal.idx].light,
                  border: `2px solid ${steps[confirmModal.idx].border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px"
                }}
              >
                <Clock size={24} color={steps[confirmModal.idx].color} />
              </div>
              <h3 style={{ margin: "0 0 6px", color: t.text, fontSize: 18, fontWeight: 700 }}>
                {steps[confirmModal.idx].label}
              </h3>
              <p style={{ margin: 0, color: t.textSub, fontSize: 13 }}>Como deseja registrar?</p>
            </div>

            {/* Now option */}
            <button
              onClick={() => registrarAgora(confirmModal.idx, confirmModal.dayKey)}
              style={{
                width: "100%",
                background: `linear-gradient(135deg, ${steps[confirmModal.idx].light}, ${steps[confirmModal.idx].color}22)`,
                border: `2px solid ${steps[confirmModal.idx].border}`,
                borderRadius: 14,
                padding: "18px 16px",
                cursor: "pointer",
                marginBottom: 12,
                fontFamily: "inherit",
                transition: "all 0.18s",
                boxShadow: `0 4px 18px ${steps[confirmModal.idx].color}22`
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800, color: steps[confirmModal.idx].color }}>✓ Registrar agora</div>
              <div style={{ fontSize: 13, color: t.textSub, marginTop: 4, fontFamily: "monospace", fontWeight: 600 }}>
                {now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
              </div>
            </button>

            {/* Manual missed-punches options */}
            <button
              onClick={() => abrirManual(confirmModal.idx, confirmModal.dayKey)}
              style={{
                width: "100%",
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                borderRadius: 14,
                padding: "16px 16px",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.18s"
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Incorp. manual de ponto</div>
              <div style={{ fontSize: "12.5px", color: t.textSub, marginTop: 4 }}>
                Insira o horário em que realmente cumpriu a batida.
              </div>
            </button>

            <button
              onClick={() => setConfirmModal(null)}
              style={{
                width: "100%",
                marginTop: 10,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                color: t.textMuted,
                padding: "6px"
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Manual Input modal */}
      {manualModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 600,
            padding: 20
          }}
          onClick={() => setManualModal(null)}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 20,
              padding: "32px 28px",
              width: "100%",
              maxWidth: 340,
              boxShadow: t.shadow
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(245,158,11,0.12)",
                  border: "2.5px solid rgba(245,158,11,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px"
                }}
              >
                <SquarePen size={20} color="#F59E0B" />
              </div>
              <h3 style={{ margin: "0 0 4px", color: t.text, fontSize: 17, fontWeight: 700 }}>Horário manual</h3>
              <p style={{ margin: 0, color: t.textSub, fontSize: 13 }}>
                {steps[manualModal.idx].done}
                {manualModal.dayKey !== todayKey() ? ` · ${dayLabel(manualModal.dayKey)}` : ""}
              </p>
            </div>

            <div style={{ background: "rgba(245,158,11,0.09)", border: "1.5px solid rgba(245,158,11,0.28)", borderRadius: 8, padding: "9px 12px", marginBottom: 16, fontSize: 12, color: "#F59E0B", lineHeight: 1.5 }}>
              ⚠️ Este registro ficará salvo com o carimbo do horário real da inserção por auditoria.
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: t.textSub, marginBottom: 7, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Horário realizado
              </label>
              <input
                type="time"
                value={manualHora}
                onChange={e => {
                  setManualHora(e.target.value);
                  setManualError("");
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: t.inputBg,
                  border: `1.5px solid ${manualError ? "#F59E0B" : t.border}`,
                  borderRadius: 9,
                  color: t.text,
                  fontSize: 28,
                  fontWeight: 700,
                  padding: "12px",
                  outline: "none",
                  fontFamily: "monospace",
                  textAlign: "center",
                  letterSpacing: "3px"
                }}
              />
              {manualError && (
                <span style={{ fontSize: 12, color: "#F59E0B", marginTop: 4, display: "block" }}>
                  {manualError}
                </span>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: t.textSub, marginBottom: 7, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Justificativa <span style={{ fontWeight: 400, color: t.textMuted }}>(opcional)</span>
              </label>
              <textarea
                value={manualJust}
                onChange={e => setManualJust(e.target.value)}
                placeholder="Ex: Esqueci de registrar na entrada..."
                rows={2}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: t.inputBg,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 9,
                  color: t.text,
                  fontSize: "13.5px",
                  padding: "10px 13px",
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "none"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setManualModal(null)}
                style={{
                  flex: 1,
                  background: t.surfaceAlt,
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  padding: "11px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  color: t.textSub
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarManual}
                style={{
                  flex: 2,
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  border: "none",
                  borderRadius: 10,
                  padding: "11px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#fff",
                  boxShadow: "0 4px 16px rgba(245,158,11,0.3)"
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Geolocation Consent & Capture modal */}
      {geoActiveFor && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 700,
            padding: 20
          }}
          onClick={() => {
            setGeoActiveFor(null);
            clearGeo();
          }}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 20,
              padding: "28px 24px",
              width: "100%",
              maxWidth: 680,
              boxShadow: t.shadow
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: geoError ? "rgba(239,68,68,0.1)" : geoCoords ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)",
                  border: `2px solid ${geoError ? t.danger : geoCoords ? t.success : t.accent}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px"
                }}
              >
                <Clock size={22} color={geoError ? t.danger : geoCoords ? t.success : t.accent} />
              </div>
              <h3 style={{ margin: "0 0 4px", color: t.text, fontSize: 18, fontWeight: 700 }}>
                Consentimento de Localização
              </h3>
              <p style={{ margin: 0, color: t.textSub, fontSize: 13 }}>
                Registrando: <strong>{steps[geoActiveFor.idx].done}</strong> ({geoActiveFor.tipo === "auto" ? "Automático" : `Manual - ${geoActiveFor.manualHora}`})
              </p>
            </div>

            {/* Consent Term Explanation */}
            <div
              style={{
                background: t.surfaceAlt,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 16,
                fontSize: "12px",
                color: t.textSub,
                lineHeight: 1.5,
                maxHeight: "150px",
                overflowY: "auto"
              }}
            >
              <div style={{ fontWeight: 700, color: t.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                🛡️ Termo de Consentimento (LGPD):
              </div>
              "Para fins de autenticidade jurídica, declaração de presença física e auditoria de registro de ponto (conforme Portaria 671/MTE e regulamentos da LGPD), autorizo o sistema a capturar a geolocalização aproximada do meu dispositivo exclusivamente neste instante da batida de ponto."
            </div>

            {/* State: Waiting Consent and Capture */}
            {!geoConsentAccepted && !geoCoords && !geoError && (
              <button
                onClick={capturarLocalizacao}
                style={{
                  width: "100%",
                  background: t.accent,
                  border: "none",
                  borderRadius: 12,
                  padding: "14px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  fontFamily: "inherit",
                  boxShadow: `0 4px 14px ${t.accentGlow}`,
                  transition: "all 0.15s"
                }}
              >
                🔓 Aceitar Termo e Capturar GPS
              </button>
            )}

            {/* State: Loading with Progressive Filter Radar */}
            {geoLoading && (
              <div style={{ textAlign: "center", padding: "16px 0", color: t.textSub, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                {/* Radar effect with bouncing rings */}
                <div style={{ position: "relative", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="animate-ping" style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: t.accent, opacity: 0.15 }} />
                  <div className="animate-pulse" style={{ position: "absolute", width: "70%", height: "70%", borderRadius: "50%", background: t.accentGlow, opacity: 0.4 }} />
                  <div style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 12px ${t.accentGlow}` }}>
                    <span style={{ fontSize: 16, color: "#fff" }}>🛰️</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <strong style={{ color: t.text, fontSize: 14 }}>Refinando Sinal GPS...</strong>
                  <span style={{ fontSize: 12, color: t.textMuted }}>
                    Filtro progressivo ativo ({geoCountdown}s restantes)
                  </span>
                </div>

                <div style={{ width: "100%", background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                    <span style={{ color: t.textMuted }}>Amostras coletadas:</span>
                    <strong style={{ color: t.text, fontFamily: "monospace" }}>{geoSamplesCount} leituras</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, alignItems: "center" }}>
                    <span style={{ color: t.textMuted }}>Melhor precisão obtida:</span>
                    {bestGeoCoords && bestGeoCoords.accuracy !== undefined ? (
                      <span style={{ 
                        fontFamily: "monospace", 
                        fontWeight: 700, 
                        color: bestGeoCoords.accuracy <= 10 ? "#16a34a" : bestGeoCoords.accuracy <= 30 ? "#d97706" : "#dc2626",
                        background: bestGeoCoords.accuracy <= 10 ? "rgba(34,197,94,0.12)" : bestGeoCoords.accuracy <= 30 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                        padding: "2px 6px",
                        borderRadius: 6
                      }}>
                        {bestGeoCoords.accuracy.toFixed(1)}m
                      </span>
                    ) : (
                      <span style={{ fontStyle: "italic", color: t.textMuted }}>Aguardando sinal...</span>
                    )}
                  </div>
                </div>

                {bestGeoCoords && (
                  <button
                    onClick={() => {
                      if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
                      if (geoIntervalId !== null) clearInterval(geoIntervalId);
                      setGeoWatchId(null);
                      setGeoIntervalId(null);
                      setGeoLoading(false);
                      setGeoCountdown(0);
                      setGeoCoords(bestGeoCoords);
                    }}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      background: t.surfaceAlt,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 10,
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.accent,
                      fontFamily: "inherit",
                      transition: "all 0.15s"
                    }}
                  >
                    ⏹️ Interromper e Usar Precisão Atual
                  </button>
                )}
              </div>
            )}

            {/* State: Error */}
            {geoError && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ background: t.dangerBg, border: `1.5px solid ${t.dangerBorder}`, borderRadius: 10, padding: "11px 14px", color: t.danger, fontSize: 12.5, lineHeight: 1.4 }}>
                  <strong>Não foi possível obter a geolocalização:</strong>
                  <div style={{ marginTop: 4 }}>{geoError}</div>
                </div>
                <button
                  onClick={capturarLocalizacao}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    background: t.surfaceAlt,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "10px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.textSub,
                    fontFamily: "inherit"
                  }}
                >
                  🔄 Tentar capturar novamente
                </button>
              </div>
            )}

            {/* State: Captured successfully (Visible Information) */}
            {geoCoords && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    background: "rgba(34,197,94,0.08)",
                    border: "1.5px solid rgba(34,197,94,0.22)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "#16a34a",
                    fontSize: 12.5,
                    textAlign: "center",
                    maxWidth: 360,
                    margin: "0 auto"
                  }}
                >
                  <div style={{ fontSize: 15, marginBottom: 2 }}>📍</div>
                  <strong style={{ display: "block", fontSize: 12.5, marginBottom: 2 }}>Localização capturada e estabilizada!</strong>
                  <span style={{ fontSize: 10, color: t.textMuted, display: "block", marginBottom: 6 }}>Filtro de Precisão Progressivo Concluído</span>
                  
                  <div style={{ fontFamily: "monospace", fontSize: 10.5, color: t.textSub, marginTop: 4, background: t.surface, padding: 6, borderRadius: 8, border: `1px solid ${t.border}` }}>
                    Latitude: <strong>{geoCoords.latitude.toFixed(6)}</strong><br />
                    Longitude: <strong>{geoCoords.longitude.toFixed(6)}</strong>
                  </div>

                  {geoCoords.accuracy !== undefined && (
                    <div style={{
                      marginTop: 6,
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      background: geoCoords.accuracy <= 10 
                        ? "rgba(34,197,94,0.15)" 
                        : geoCoords.accuracy <= 30 
                        ? "rgba(245,158,11,0.15)" 
                        : "rgba(239,68,68,0.15)",
                      color: geoCoords.accuracy <= 10 
                        ? "#15803d" 
                        : geoCoords.accuracy <= 30 
                        ? "#b45309" 
                        : "#b91c1c",
                      border: `1px solid ${
                        geoCoords.accuracy <= 10 
                          ? "rgba(34,197,94,0.3)" 
                          : geoCoords.accuracy <= 30 
                          ? "rgba(245,158,11,0.3)" 
                          : "rgba(239,68,68,0.3)"
                      }`
                    }}>
                      <span>{geoCoords.accuracy <= 10 ? "🎯" : geoCoords.accuracy <= 30 ? "📡" : "⚠️"}</span>
                      <span>
                        Precisão: <strong>{geoCoords.accuracy.toFixed(1)}m</strong> 
                        ({geoCoords.accuracy <= 10 ? "Máxima / <10m" : geoCoords.accuracy <= 30 ? "Média" : "Baixa"})
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6, fontStyle: "italic" }}>
                    Este carimbo de GPS será indexado no log de auditoria.
                  </div>
                </div>

                {geoCoords.accuracy !== undefined && geoCoords.accuracy > 10 && (
                  <div style={{
                    fontSize: 11,
                    color: t.textSub,
                    background: t.surfaceAlt,
                    border: `1px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginTop: 10,
                    textAlign: "left",
                    lineHeight: 1.45
                  }}>
                    <strong style={{ display: "block", color: t.text, marginBottom: 4, fontSize: 11.5 }}>💡 Como alcançar precisão de 10m:</strong>
                    • Acesse por um <strong>celular / smartphone</strong> (computadores terrestres não possuem chips de GPS reais e estimam por IP).<br />
                    • Ative o <strong>Wi-Fi</strong> do celular (mesmo se usar dados móveis, ajuda na triangulação Wi-FI SSID).<br />
                    • Evite subsolos. Fique próximo a <strong>janelas</strong> ou áreas externas para conectar com satélites GPS.<br />
                    • Verifique se o navegador tem permissão para usar a <strong>"Localização Precisa"</strong>.
                  </div>
                )}

                <button
                  onClick={finalizarComGeo}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    background: "linear-gradient(135deg, #22C55E, #16A34A)",
                    border: "none",
                    borderRadius: 12,
                    padding: "14px",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#fff",
                    fontFamily: "inherit",
                    boxShadow: "0 4px 16px rgba(34,197,94,0.3)"
                  }}
                >
                  🚀 Confirmar e Enviar para Auditoria
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setGeoActiveFor(null);
                clearGeo();
              }}
              style={{
                width: "100%",
                marginTop: 8,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                color: t.textMuted,
                padding: "6px"
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
