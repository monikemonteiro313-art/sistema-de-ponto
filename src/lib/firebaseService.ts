import { db } from "./firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc 
} from "firebase/firestore";
import { User, PontosGlobal, AuditLogEntry, EmpresaConfig } from "../types";
import { INITIAL_USERS, SEED_PONTOS } from "../data/mockData";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write"
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to sanitize undefined values for Firestore to prevent errors
function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanObject(val);
      }
    }
    return cleaned;
  }
  return obj;
}

export async function initializeDbIfEmpty() {
  const usersColl = collection(db, "users");
  let usersSnapshot;
  try {
    usersSnapshot = await getDocs(usersColl);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "users");
  }
  
  if (usersSnapshot.empty) {
    console.log("Firestore is empty. Seeding initial database...");
    
    // Seed Users
    for (const u of INITIAL_USERS) {
      try {
        await setDoc(doc(db, "users", String(u.id)), cleanObject(u));
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${u.id}`);
      }
    }

    // Seed Pontos for existing seed users
    for (const userIdStr of Object.keys(SEED_PONTOS)) {
      const userId = Number(userIdStr);
      const userDays = SEED_PONTOS[userId];
      if (userDays) {
        try {
          await setDoc(doc(db, "pontos", String(userId)), cleanObject({ days: userDays }));
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `pontos/${userId}`);
        }
      }
    }

    // Seed Configs
    try {
      await setDoc(doc(db, "config", "empresa"), cleanObject({ nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" }));
      await setDoc(doc(db, "config", "minimoHoras"), { value: 7 });
      await setDoc(doc(db, "config", "feriados"), { list: [] });
      await setDoc(doc(db, "config", "wizard"), { done: false });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "config");
    }
    
    console.log("Database seeding completed successfully!");
  }
}

// Users functions
export async function fetchAllUsers(): Promise<User[]> {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const list: User[] = [];
    usersSnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as User);
    });
    return list.sort((a, b) => a.id - b.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "users");
  }
}

export async function saveUserToDb(user: User): Promise<void> {
  try {
    await setDoc(doc(db, "users", String(user.id)), cleanObject(user));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
  }
}

export async function deleteUserFromDb(userId: number): Promise<void> {
  try {
    await deleteDoc(doc(db, "users", String(userId)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
  }
}

// Pontos functions
export async function fetchAllPontos(): Promise<PontosGlobal> {
  try {
    const snapshot = await getDocs(collection(db, "pontos"));
    const pontos: PontosGlobal = {};
    snapshot.forEach((docSnap) => {
      const userId = Number(docSnap.id);
      const data = docSnap.data();
      if (data && data.days) {
        pontos[userId] = data.days;
      }
    });
    return pontos;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "pontos");
  }
}

export async function saveUserPontosToDb(userId: number, days: any): Promise<void> {
  try {
    await setDoc(doc(db, "pontos", String(userId)), cleanObject({ days }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `pontos/${userId}`);
  }
}

// Audit logs functions
export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const snapshot = await getDocs(collection(db, "auditLogs"));
    const list: AuditLogEntry[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as AuditLogEntry);
    });
    return list.sort((a, b) => {
      const timeA = new Date(a.quando).getTime();
      const timeB = new Date(b.quando).getTime();
      return timeB - timeA;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "auditLogs");
  }
}

export async function saveAuditLogToDb(log: AuditLogEntry): Promise<void> {
  try {
    await setDoc(doc(db, "auditLogs", String(log.id)), cleanObject(log));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `auditLogs/${log.id}`);
  }
}

// Config functions
export async function fetchEmpresaConfig(): Promise<EmpresaConfig> {
  try {
    const docSnap = await getDoc(doc(db, "config", "empresa"));
    if (docSnap.exists()) {
      return docSnap.data() as EmpresaConfig;
    }
    return { nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "config/empresa");
  }
}

export async function saveEmpresaConfigToDb(config: EmpresaConfig): Promise<void> {
  try {
    await setDoc(doc(db, "config", "empresa"), cleanObject(config));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/empresa");
  }
}

export async function fetchMinimoHoras(): Promise<number> {
  try {
    const docSnap = await getDoc(doc(db, "config", "minimoHoras"));
    if (docSnap.exists()) {
      return docSnap.data().value;
    }
    return 7;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "config/minimoHoras");
  }
}

export async function saveMinimoHorasToDb(val: number): Promise<void> {
  try {
    await setDoc(doc(db, "config", "minimoHoras"), { value: val });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/minimoHoras");
  }
}

export async function fetchFeriados(): Promise<string[]> {
  try {
    const docSnap = await getDoc(doc(db, "config", "feriados"));
    if (docSnap.exists()) {
      return docSnap.data().list || [];
    }
    return [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "config/feriados");
  }
}

export async function saveFeriadosToDb(list: string[]): Promise<void> {
  try {
    await setDoc(doc(db, "config", "feriados"), { list });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/feriados");
  }
}

export async function fetchWizardDone(): Promise<boolean> {
  try {
    const docSnap = await getDoc(doc(db, "config", "wizard"));
    if (docSnap.exists()) {
      return !!docSnap.data().done;
    }
    return false;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "config/wizard");
  }
}

export async function saveWizardDoneToDb(done: boolean): Promise<void> {
  try {
    await setDoc(doc(db, "config", "wizard"), { done });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/wizard");
  }
}
