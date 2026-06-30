import { Jornada, User, PontosGlobal, PeriodoFerias, DiaPontos } from "../types";

export const JORNADAS_PREDEFINIDAS: Jornada[] = [
  {
    id: "clt_8h",
    nome: "CLT Padrão 8h",
    entrada: "08:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex · 8h/dia · 44h/semana"
  },
  {
    id: "clt_6h",
    nome: "Jornada 6h",
    entrada: "07:00",
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: "13:00",
    diasSemana: [1, 2, 3, 4, 5, 6],
    horasDia: 6,
    descricao: "Seg–Sáb · 6h/dia · 36h/semana (sem intervalo obrigatório)"
  },
  {
    id: "clt_12x36",
    nome: "12x36",
    entrada: "07:00",
    saidaAlmoco: "13:00",
    retornoAlmoco: "14:00",
    saida: "19:00",
    diasSemana: [1, 3, 5],
    horasDia: 12,
    descricao: "12h trabalhadas · 36h de descanso (revezamento)"
  },
  {
    id: "clt_noturno",
    nome: "Noturno 8h",
    entrada: "22:00",
    saidaAlmoco: "02:00",
    retornoAlmoco: "03:00",
    saida: "06:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex · 22h–06h · adicional noturno aplicável"
  },
  {
    id: "clt_tarde",
    nome: "Vespertino 8h",
    entrada: "13:00",
    saidaAlmoco: "17:00",
    retornoAlmoco: "18:00",
    saida: "22:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex · 13h–22h"
  },
  {
    id: "clt_meio",
    nome: "Meio Período Manhã",
    entrada: "08:00",
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: "12:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 4,
    descricao: "Seg–Sex · 08h–12h · 4h/dia"
  },
  {
    id: "clt_meio_t",
    nome: "Meio Período Tarde",
    entrada: "13:00",
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 4,
    descricao: "Seg–Sex · 13h–17h · 4h/dia"
  },
  {
    id: "comercial",
    nome: "Comercial 9h",
    entrada: "09:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "18:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex · 09h–18h"
  },
  {
    id: "sabado",
    nome: "Seg–Sáb 7h20",
    entrada: "07:20",
    saidaAlmoco: "11:20",
    retornoAlmoco: "12:00",
    saida: "16:00",
    diasSemana: [1, 2, 3, 4, 5, 6],
    horasDia: 7.33,
    descricao: "Seg–Sáb · 44h/semana distribuídas"
  },
  {
    id: "escala_5x1",
    nome: "Escala 5x1",
    entrada: "08:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "5 dias trabalhados · 1 folga (revezamento)"
  },
  {
    id: "escala_5x2",
    nome: "Escala 5x2",
    entrada: "08:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex · 2 dias de folga no fim de semana · 40h/semana"
  },
  {
    id: "escala_6x1",
    nome: "Escala 6x1",
    entrada: "08:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:00",
    diasSemana: [1, 2, 3, 4, 5, 6],
    horasDia: 8,
    descricao: "6 dias trabalhados · 1 folga (revezamento)"
  },
  {
    id: "home_flex",
    nome: "Home Office / Flexível",
    entrada: null,
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: null,
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Sem horário fixo · carga horária diária de referência"
  },
  {
    id: "personalizada",
    nome: "Criar nova jornada",
    entrada: null,
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: null,
    diasSemana: [],
    horasDia: 0,
    descricao: "Defina nome, horários e dias manualmente"
  }
];

export function getJornada(id: string): Jornada | null {
  return JORNADAS_PREDEFINIDAS.find(j => j.id === id) || null;
}

export const SUPERADMIN_MAT = "090909";

const NAMES = [
  "Adriana de Sousa Marcelino",
  "Aline Gabriela de Araujo da Silva",
  "Amanda Caroline",
  "Ana Paula da Silva",
  "Anatalia Rodrigues F. da Silva",
  "Andreia Silva Oliveira",
  "Antônia Aparecida",
  "Antônia Aparecida",
  "Brennda",
  "Bruna Da Silva",
  "Cirlene da Silva",
  "Crisciele Tavares da Silva",
  "Crys Pâmela",
  "Daiane Melo Rodrigues",
  "Darciele da Silva Ferreira",
  "Darlene Darlene dos santos",
  "Daylane",
  "Edinalva da paixão",
  "Ediomar",
  "Ednalva",
  "Eleuza Cristina",
  "Elisangela Machado",
  "Elzirene Batista dos santos",
  "Erica Lopes",
  "Evely Silva Nascimento",
  "Franciele Ramos de Oliveira",
  "Francisca Leiliane",
  "Gabriela Josefa dos Santos",
  "Gislene Borges",
  "Helenice De Oliveira Santos",
  "Jaine Maria da Silva",
  "Joangelo",
  "Josefa Adriana",
  "Joselma da Silva",
  "Joserlane",
  "Keiliane Bezerra",
  "Laiane Silva",
  "Lucileide da Silva",
  "Luzelena",
  "Magna Rodrigues",
  "Magna Rodrigues",
  "Maria Aparecida",
  "Maria Carmelita",
  "Maria Dorilene",
  "Maria Edicleide",
  "Maria Eliene",
  "Maria Felipe da Silva",
  "Maria Inês",
  "Maria Jose Silva",
  "Maria Jose Silva",
  "Maria Luciana Silva",
  "Maria Marcelina",
  "Mariana Tamires",
  "Marlene Silva Lima",
  "Marta Rodrigues de Aguiar",
  "Marta Rodrigues de Aguiar",
  "Martiene Almeida Magalhaes",
  "Milene de Jesus",
  "Monike pereira",
  "Nubia da Silva",
  "Rebeca Querem Machado",
  "Sheila",
  "Sulany",
  "Tamara Cristina",
  "Tatiane da Silva",
  "Tatiele da Silva",
  "Tatilla fernanda rezende",
  "Valdirene",
  "Valéria Silva",
  "Valquiria Maria",
  "Vanessa Francisca",
  "Vanessa Santos",
  "Vania da Silva",
  "Vera Lucia Alves"
];

export const INITIAL_USERS: User[] = [
  {
    id: 1,
    matricula: SUPERADMIN_MAT,
    nome: "Administrador",
    tipo: "adm-dev",
    senha: "Admin@090909",
    primeiroAcesso: true,
    bloqueado: false,
    desativado: false,
    perm_trocar_senha_adm: false,
    termoAceito: false,
    termoAceitoEm: null,
    jornadaId: null,
    jornadaCustom: null,
    criadoEm: "2026-05-01T08:00:00Z"
  },
  ...NAMES.map((rawNome, index) => {
    const nome = rawNome
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const matricula = String(200001 + index);

    // Get the first word of the name
    const firstWord = nome.split(" ")[0] || "";
    let prefix = "";
    if (firstWord.length >= 2) {
      prefix = firstWord.substring(0, 2);
    } else {
      prefix = (firstWord + "X").substring(0, 2);
    }
    // Capitalize first letter, make second lowercase
    prefix = prefix.charAt(0).toUpperCase() + prefix.charAt(1).toLowerCase();

    const senha = `${prefix}${matricula}`;

    const JORNADA_OPTIONS = [
      "clt_8h",
      "clt_6h",
      "clt_noturno",
      "clt_tarde",
      "comercial",
      "sabado",
      "escala_5x2",
      "escala_6x1"
    ];
    const jornadaId = JORNADA_OPTIONS[index % JORNADA_OPTIONS.length];

    return {
      id: index + 2,
      matricula,
      nome,
      tipo: "colaborador" as const,
      senha,
      primeiroAcesso: false,
      bloqueado: false,
      desativado: false,
      perm_trocar_senha_adm: false,
      termoAceito: false,
      termoAceitoEm: null,
      jornadaId,
      jornadaCustom: null,
      criadoEm: "2026-06-26T12:00:00Z"
    };
  })
];

export const SEED_PONTOS: PontosGlobal = {};

// Help functions for point generation
function pad(n: number) {
  return String(n).padStart(2, "0");
}

function buildIsoTimestamp(dateStr: string, timeStr: string, offsetMinutes: number, nextDay: boolean): string {
  const dateParts = dateStr.split("-");
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);

  const d = new Date(year, month, day, 12, 0, 0, 0);
  if (nextDay) {
    d.setDate(d.getDate() + 1);
  }

  const [hhStr, mmStr] = timeStr.split(":");
  let totalMin = parseInt(hhStr, 10) * 60 + parseInt(mmStr, 10) + offsetMinutes;
  
  const finalHour = Math.floor(totalMin / 60) % 24;
  const finalMin = Math.max(0, Math.min(59, totalMin % 60));

  d.setHours(finalHour, finalMin, 0, 0);
  return d.toISOString();
}

// Populate SEED_PONTOS dynamically for all NAMES
NAMES.forEach((rawNome, index) => {
  const id = index + 2;
  const JORNADA_OPTIONS = [
    "clt_8h",
    "clt_6h",
    "clt_noturno",
    "clt_tarde",
    "comercial",
    "sabado",
    "escala_5x2",
    "escala_6x1"
  ];
  const jId = JORNADA_OPTIONS[index % JORNADA_OPTIONS.length];
  const j = getJornada(jId);

  const userPontos: Record<string, DiaPontos> = {};

  const totalMonths = [
    { month: 5, daysValue: 31 }, // May 2026
    { month: 6, daysValue: 26 }  // June 2026 (up to today, 26)
  ];

  totalMonths.forEach(({ month, daysValue }) => {
    for (let day = 1; day <= daysValue; day++) {
      const dayKey = `2026-${pad(month)}-${pad(day)}`;
      const dateObj = new Date(2026, month - 1, day);
      const diaSem = dateObj.getDay();
      const diasUteis = j?.diasSemana || [1, 2, 3, 4, 5];

      if (diasUteis.includes(diaSem)) {
        // Mostly correct points, high deterministic variation
        const seedValue = (id * 13 + day * 27) % 100;

        if (seedValue < 2) {
          // 2% sick leave (atestado)
          userPontos[dayKey] = [
            { ocorrencia: "atestado", parcial: false, tipo: "manual" },
            null, null, null
          ];
        } else if (seedValue < 4) {
          // 2% absence (falta)
          userPontos[dayKey] = [
            { ocorrencia: "falta", tipo: "manual" },
            null, null, null
          ];
        } else if (seedValue < 5) {
          // 1% missing punch (forgot to stamp)
          const entTime = j?.entrada || "08:00";
          const hEnt = buildIsoTimestamp(dayKey, entTime, (seedValue % 10) - 5, false);
          userPontos[dayKey] = [
            { hora: hEnt, tipo: "auto", registradoEm: hEnt },
            null, null, null
          ];
        } else {
          // 95% regular completed stamps
          const entTime = j?.entrada || "08:00";
          const sAlmTime = j?.saidaAlmoco;
          const rAlmTime = j?.retornoAlmoco;
          const sTime = j?.saida || "17:00";

          // Tiny natural fluctuations
          const devEnt = (seedValue % 13) - 6; // -6 to +6 min
          const devSaidaAlm = ((seedValue + id) % 11) - 5;
          const devRetornoAlm = ((seedValue + day) % 9) - 4;
          const devSaida = ((seedValue * 2 + id) % 15) - 7;

          const hEnt = buildIsoTimestamp(dayKey, entTime, devEnt, false);

          if (sAlmTime && rAlmTime) {
            const hSaidaAlm = buildIsoTimestamp(dayKey, sAlmTime, devSaidaAlm, false);
            const hRetornoAlm = buildIsoTimestamp(dayKey, rAlmTime, devRetornoAlm, false);
            const crossS = parseInt(sTime.split(":")[0]) < parseInt(entTime.split(":")[0]);
            const hSaida = buildIsoTimestamp(dayKey, sTime, devSaida, crossS);

            userPontos[dayKey] = [
              { hora: hEnt, tipo: "auto", registradoEm: hEnt },
              { hora: hSaidaAlm, tipo: "auto", registradoEm: hSaidaAlm },
              { hora: hRetornoAlm, tipo: "auto", registradoEm: hRetornoAlm },
              { hora: hSaida, tipo: "auto", registradoEm: hSaida }
            ];
          } else {
            const crossS = parseInt(sTime.split(":")[0]) < parseInt(entTime.split(":")[0]);
            const hSaida = buildIsoTimestamp(dayKey, sTime, devSaida, crossS);

            userPontos[dayKey] = [
              { hora: hEnt, tipo: "auto", registradoEm: hEnt },
              null,
              null,
              { hora: hSaida, tipo: "auto", registradoEm: hSaida }
            ];
          }
        }
      }
    }
  });

  SEED_PONTOS[id] = userPontos;
});

