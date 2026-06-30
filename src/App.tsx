import { useState, useEffect } from "react";
import { T } from "./components/Theme";
import { User, ThemeColors, PontosGlobal, AuditLogEntry, EmpresaConfig } from "./types";
import { LoginScreen } from "./components/LoginScreen";
import { WizardScreen } from "./components/WizardScreen";
import { TermoCienciaScreen } from "./components/TermoCienciaScreen";
import { EmployeePanel } from "./components/EmployeePanel";
import { AdmPanel } from "./components/AdmPanel";
import { AdmOperadorPanel } from "./components/AdmOperadorPanel";

import {
  initializeDbIfEmpty,
  fetchAllUsers,
  saveUserToDb,
  deleteUserFromDb,
  fetchAllPontos,
  saveUserPontosToDb,
  fetchAuditLogs,
  saveAuditLogToDb,
  fetchEmpresaConfig,
  saveEmpresaConfigToDb,
  fetchMinimoHoras,
  saveMinimoHorasToDb,
  fetchFeriados,
  saveFeriadosToDb,
  fetchWizardDone,
  saveWizardDoneToDb
} from "./lib/firebaseService";

export default function App() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");
  const t: ThemeColors = T[themeMode];
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [isDbLoading, setIsDbLoading] = useState<boolean>(true);

  // Core Global States
  const [users, setUsers] = useState<User[]>([]);
  const [pontos, setPontos] = useState<PontosGlobal>({});
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [minimoHorasDia, setMinimoHorasDia] = useState<number>(7);
  const [empresaConfig, setEmpresaConfig] = useState<EmpresaConfig>({ nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" });
  const [feriados, setFeriados] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<"login" | "wizard" | "termo" | "main">("wizard");

  // Load initial data from Firestore
  useEffect(() => {
    async function loadData() {
      try {
        setIsDbLoading(true);
        // Seed if first time
        await initializeDbIfEmpty();
        
        // Fetch all database records
        const [dbUsers, dbPontos, dbLogs, dbMin, dbEmpresa, dbFeriados, wizardDone] = await Promise.all([
          fetchAllUsers(),
          fetchAllPontos(),
          fetchAuditLogs(),
          fetchMinimoHoras(),
          fetchEmpresaConfig(),
          fetchFeriados(),
          fetchWizardDone()
        ]);
        
        setUsers(dbUsers);
        setPontos(dbPontos);
        setAuditLogs(dbLogs);
        setMinimoHorasDia(dbMin);
        setEmpresaConfig(dbEmpresa);
        setFeriados(dbFeriados);

        // Cache locally for offline survival
        localStorage.setItem("hr_cached_users", JSON.stringify(dbUsers));
        localStorage.setItem("hr_cached_pontos", JSON.stringify(dbPontos));
        localStorage.setItem("hr_cached_audit_logs", JSON.stringify(dbLogs));
        localStorage.setItem("hr_cached_minimo_horas_dia", JSON.stringify(dbMin));
        localStorage.setItem("hr_cached_empresa_config", JSON.stringify(dbEmpresa));
        localStorage.setItem("hr_cached_feriados", JSON.stringify(dbFeriados));
        localStorage.setItem("hr_cached_wizard_done", JSON.stringify(wizardDone));
        
        // Determine starting screen based on session and wizard completion
        const cachedUserStr = localStorage.getItem("hr_current_user");
        if (cachedUserStr) {
          const u: User = JSON.parse(cachedUserStr);
          const freshUser = dbUsers.find(x => x.id === u.id);
          if (freshUser && !freshUser.desativado) {
            setCurrentUser(freshUser);
            setScreen(freshUser.termoAceito ? "main" : "termo");
          } else {
            setCurrentUser(null);
            setScreen("login");
          }
        } else {
          setScreen(wizardDone ? "login" : "wizard");
        }
      } catch (error) {
        console.error("Failed to load database from Firestore, falling back to local storage cache:", error);
        try {
          const cachedUsers = localStorage.getItem("hr_cached_users");
          const cachedPontos = localStorage.getItem("hr_cached_pontos");
          const cachedLogs = localStorage.getItem("hr_cached_audit_logs");
          const cachedMin = localStorage.getItem("hr_cached_minimo_horas_dia");
          const cachedEmpresa = localStorage.getItem("hr_cached_empresa_config");
          const cachedFeriados = localStorage.getItem("hr_cached_feriados");
          const cachedWizard = localStorage.getItem("hr_cached_wizard_done");
          
          let finalUsers: User[] = [];
          if (cachedUsers) {
            finalUsers = JSON.parse(cachedUsers);
            setUsers(finalUsers);
          } else {
            const { INITIAL_USERS } = await import("./data/mockData");
            finalUsers = INITIAL_USERS;
            setUsers(INITIAL_USERS);
          }
          
          if (cachedPontos) {
            setPontos(JSON.parse(cachedPontos));
          } else {
            const { SEED_PONTOS } = await import("./data/mockData");
            setPontos(SEED_PONTOS);
          }
          
          if (cachedLogs) {
            setAuditLogs(JSON.parse(cachedLogs));
          }
          if (cachedMin) {
            setMinimoHorasDia(JSON.parse(cachedMin));
          }
          if (cachedEmpresa) {
            setEmpresaConfig(JSON.parse(cachedEmpresa));
          }
          if (cachedFeriados) {
            setFeriados(JSON.parse(cachedFeriados));
          }
          
          const isWizardDone = cachedWizard ? JSON.parse(cachedWizard) : false;
          const cachedUserStr = localStorage.getItem("hr_current_user");
          if (cachedUserStr) {
            const u: User = JSON.parse(cachedUserStr);
            const freshUser = finalUsers.find(x => x.id === u.id);
            if (freshUser && !freshUser.desativado) {
              setCurrentUser(freshUser);
              setScreen(freshUser.termoAceito ? "main" : "termo");
            } else {
              setCurrentUser(null);
              setScreen("login");
            }
          } else {
            setScreen(isWizardDone ? "login" : "wizard");
          }
        } catch (innerErr) {
          console.error("Critical: Failed to load local cache backup:", innerErr);
        }
      } finally {
        setIsDbLoading(false);
      }
    }
    loadData();
  }, []);

  // For Admin views which can toggle between "adm-dev" config and "adm-operator" points
  const [adminRoleMode, setAdminRoleMode] = useState<"dev" | "operador">("operador");

  // Wrapper functions to keep local state and Firestore in perfect sync
  const updateUsers = (newUsersOrFn: User[] | ((prev: User[]) => User[])) => {
    setUsers((prev) => {
      const next = typeof newUsersOrFn === "function" ? newUsersOrFn(prev) : newUsersOrFn;
      
      // Cache locally immediately for offline-first resilience
      localStorage.setItem("hr_cached_users", JSON.stringify(next));

      // Determine differences and sync asynchronously to Firestore
      const prevMap = new Map(prev.map(u => [u.id, u]));
      const nextMap = new Map(next.map(u => [u.id, u]));
      
      // Save added/updated
      for (const u of next) {
        const p = prevMap.get(u.id);
        if (!p || JSON.stringify(p) !== JSON.stringify(u)) {
          saveUserToDb(u).catch(err => console.warn("Failed to save user to Firestore (offline?):", err));
        }
      }
      // Delete removed
      for (const p of prev) {
        if (!nextMap.has(p.id)) {
          deleteUserFromDb(p.id).catch(err => console.warn("Failed to delete user from Firestore (offline?):", err));
        }
      }
      return next;
    });
  };

  const updatePontos = (newPontosOrFn: PontosGlobal | ((prev: PontosGlobal) => PontosGlobal)) => {
    setPontos((prev) => {
      const next = typeof newPontosOrFn === "function" ? newPontosOrFn(prev) : newPontosOrFn;
      
      // Cache locally immediately for offline-first resilience
      localStorage.setItem("hr_cached_pontos", JSON.stringify(next));

      // Determine updated user points and sync to Firestore
      for (const userIdStr of Object.keys(next)) {
        const userId = Number(userIdStr);
        const nextDays = next[userId];
        const prevDays = prev[userId];
        if (!prevDays || JSON.stringify(nextDays) !== JSON.stringify(prevDays)) {
          saveUserPontosToDb(userId, nextDays).catch(err => console.warn("Failed to save pontos to Firestore (offline?):", err));
        }
      }
      return next;
    });
  };

  const updateAuditLogs = (newLogsOrFn: AuditLogEntry[] | ((prev: AuditLogEntry[]) => AuditLogEntry[])) => {
    setAuditLogs((prev) => {
      const next = typeof newLogsOrFn === "function" ? newLogsOrFn(prev) : newLogsOrFn;
      
      // Cache locally immediately for offline-first resilience
      localStorage.setItem("hr_cached_audit_logs", JSON.stringify(next));

      // Push new logs to Firestore
      const prevIds = new Set(prev.map(l => l.id));
      for (const log of next) {
        if (!prevIds.has(log.id)) {
          saveAuditLogToDb(log).catch(err => console.warn("Failed to save audit log to Firestore (offline?):", err));
        }
      }
      return next;
    });
  };

  const updateMinimoHorasDia = (newValOrFn: number | ((prev: number) => number)) => {
    setMinimoHorasDia((prev) => {
      const next = typeof newValOrFn === "function" ? newValOrFn(prev) : newValOrFn;
      
      // Cache locally immediately for offline-first resilience
      localStorage.setItem("hr_cached_minimo_horas_dia", JSON.stringify(next));

      if (next !== prev) {
        saveMinimoHorasToDb(next).catch(err => console.warn("Failed to save minimum hours to Firestore (offline?):", err));
      }
      return next;
    });
  };

  const updateEmpresaConfig = (newConfigOrFn: EmpresaConfig | ((prev: EmpresaConfig) => EmpresaConfig)) => {
    setEmpresaConfig((prev) => {
      const next = typeof newConfigOrFn === "function" ? newConfigOrFn(prev) : newConfigOrFn;
      
      // Cache locally immediately for offline-first resilience
      localStorage.setItem("hr_cached_empresa_config", JSON.stringify(next));

      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        saveEmpresaConfigToDb(next).catch(err => console.warn("Failed to save company config to Firestore (offline?):", err));
      }
      return next;
    });
  };

  const updateFeriados = (newFeriadosOrFn: string[] | ((prev: string[]) => string[])) => {
    setFeriados((prev) => {
      const next = typeof newFeriadosOrFn === "function" ? newFeriadosOrFn(prev) : newFeriadosOrFn;
      
      // Cache locally immediately for offline-first resilience
      localStorage.setItem("hr_cached_feriados", JSON.stringify(next));

      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        saveFeriadosToDb(next).catch(err => console.warn("Failed to save feriados to Firestore (offline?):", err));
      }
      return next;
    });
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("hr_current_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("hr_current_user");
    }
  }, [currentUser]);


  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => console.log("Geolocation background check failed:", err),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    }
  }, [currentUser]);

  function handleAddLog(acao: string, alvo: string, detalhe = "") {
    const entryId = Date.now() + Math.random();
    const newEntry: AuditLogEntry = {
      id: entryId,
      quando: new Date().toISOString(),
      quem: currentUser ? currentUser.nome : "Sistema",
      quemMat: currentUser ? currentUser.matricula : "000000",
      acao,
      alvo,
      detalhe,
      latitude: userCoords?.latitude,
      longitude: userCoords?.longitude
    };
    
    updateAuditLogs(prev => [newEntry, ...prev]);

    // Asynchronously update coordinates if available
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setUserCoords({ latitude: lat, longitude: lon });
          updateAuditLogs(prev =>
            prev.map(item =>
              item.id === entryId
                ? { ...item, latitude: lat, longitude: lon }
                : item
            )
          );
        },
        null,
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }

  // Auth flow callbacks
  function handleWizardDone(wizardData: any) {
    updateUsers(p =>
      p.map(u =>
        u.matricula === "090909"
          ? {
              ...u,
              senha: wizardData.senha,
              nome: wizardData.nomeAdm || u.nome,
              criadoEm: new Date().toISOString()
            }
          : u
      )
    );
    saveWizardDoneToDb(true).catch(err => console.warn("Failed to save wizard completion state to Firestore:", err));
    localStorage.setItem("hr_cached_wizard_done", "true");
    setScreen("login");
  }

  function handleLogin(matricula: string) {
    const user = users.find(u => u.matricula === matricula && !u.desativado);
    if (!user) return;

    setCurrentUser(user);
    if (!user.termoAceito) {
      setScreen("termo");
    } else {
      setScreen("main");
    }
    handleAddLog("Efetuou Login", `${user.nome} (${user.matricula})`);
  }

  function handleAcceptTerm() {
    if (!currentUser) return;
    const updateTime = new Date().toISOString();
    const updated: User = {
      ...currentUser,
      termoAceito: true,
      termoAceitoEm: updateTime
    };
    updateUsers(prev => prev.map(u => (u.id === currentUser.id ? updated : u)));
    setCurrentUser(updated);
    setScreen("main");
    handleAddLog(
      "Aceitou Termo de Ciência",
      `${currentUser.nome} (${currentUser.matricula})`,
      "Conformidade LGPD / Portaria 671/2021"
    );
  }

  function handleLogout() {
    if (currentUser) {
      handleAddLog("Efetuou Logout", `${currentUser.nome} (${currentUser.matricula})`);
    }
    setCurrentUser(null);
    setScreen("login");
  }

  if (isDbLoading) {
    return (
      <div style={{
        background: "#0f172a",
        color: "#f8fafc",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif"
      }}>
        <div style={{
          border: "4px solid rgba(255, 255, 255, 0.1)",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          borderLeftColor: "#3b82f6",
          animation: "spin 1s linear infinite"
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ marginTop: "16px", fontSize: "14px", color: "#94a3b8", fontWeight: 500 }}>
          Carregando banco de dados Firestore...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: t.bg,
        color: t.text,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        transition: "background-color 0.25s, color 0.25s"
      }}
    >
      {/* Floating Theme Button (Corner Top-Right) */}
      <div style={{ position: "absolute", top: 12, right: 18, zIndex: 100 }}>
        <button
          onClick={() => setThemeMode(v => (v === "light" ? "dark" : "light"))}
          style={{
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            color: t.text,
            padding: "8px 12px",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 700,
            transition: "all 0.2s"
          }}
        >
          {themeMode === "light" ? "🌙 Escuro" : "☀️ Claro"}
        </button>
      </div>

      {screen === "wizard" && (
        <WizardScreen t={t} onComplete={(nome, pw) => handleWizardDone({ nomeAdm: nome, senha: pw })} />
      )}

      {screen === "login" && (
        <LoginScreen
          mode={themeMode}
          t={t}
          users={users}
          onLogin={handleLogin}
          isAdminMode={isAdminMode}
          setIsAdminMode={setIsAdminMode}
          onToggleTheme={() => setThemeMode(v => (v === "light" ? "dark" : "light"))}
        />
      )}

      {screen === "termo" && currentUser && (
        <TermoCienciaScreen t={t} currentUser={currentUser} onAceitar={handleAcceptTerm} onRecusar={handleLogout} />
      )}

      {screen === "main" && currentUser && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          {/* Decides which dashboards to render based on user type */}
          {currentUser.tipo === "adm-dev" ? (
            <>
              {/* Special Role Toggle Header for admins */}
              <div
                style={{
                  background: t.surface,
                  borderBottom: `2px solid ${t.border}`,
                  padding: "6px 28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setAdminRoleMode("operador")}
                    style={{
                      background: adminRoleMode === "operador" ? t.accentGlow : "none",
                      border: "none",
                      color: adminRoleMode === "operador" ? t.accent : t.textSub,
                      fontSize: "12.5px",
                      fontWeight: 700,
                      padding: "8px 14px",
                      borderRadius: 8,
                      cursor: "pointer"
                    }}
                  >
                    📊 Frequência & Operador
                  </button>
                  <button
                    onClick={() => setAdminRoleMode("dev")}
                    style={{
                      background: adminRoleMode === "dev" ? t.accentGlow : "none",
                      border: "none",
                      color: adminRoleMode === "dev" ? t.accent : t.textSub,
                      fontSize: "12.5px",
                      fontWeight: 700,
                      padding: "8px 14px",
                      borderRadius: 8,
                      cursor: "pointer"
                    }}
                  >
                    🔑 Credenciais & ADMs
                  </button>
                </div>
                <span style={{ fontSize: "11px", color: t.textMuted }}>Modo Administrador</span>
              </div>

              {adminRoleMode === "dev" ? (
                <AdmPanel
                  t={t}
                  users={users}
                  setUsers={updateUsers}
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  auditLogExterno={auditLogs}
                  onAddLog={handleAddLog}
                  feriados={feriados}
                  setFeriados={updateFeriados}
                  pontosGlobal={pontos}
                  setPontosGlobal={updatePontos}
                />
              ) : (
                <AdmOperadorPanel
                  t={t}
                  users={users}
                  setUsers={updateUsers}
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onGoAdm={() => setAdminRoleMode("dev")}
                  pontosGlobal={pontos}
                  setPontosGlobal={updatePontos}
                  onAddLog={handleAddLog}
                  minimoHorasDia={minimoHorasDia}
                  setMinimoHorasDia={updateMinimoHorasDia}
                  empresaConfig={empresaConfig}
                  setEmpresaConfig={updateEmpresaConfig}
                  feriados={feriados}
                />
              )}
            </>
          ) : (
            <EmployeePanel
              t={t}
              currentUser={currentUser}
              onLogout={handleLogout}
              pontosGlobal={pontos}
              setPontosGlobal={updatePontos}
              onAddLog={handleAddLog}
              feriados={feriados}
            />
          )}
        </div>
      )}
    </div>
  );
}
