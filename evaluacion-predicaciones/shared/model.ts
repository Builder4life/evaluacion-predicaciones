export const criterios = [
  [
    "Fidelidad bíblica",
    "El mensaje respeta el sentido original del pasaje y no lo usa como pretexto.",
  ],
  [
    "Cristo en el centro",
    "El mensaje apunta a la obra de Cristo y a la vida en el Nuevo Pacto.",
  ],
  [
    "Estructura y claridad",
    "Una idea central, puntos ordenados y una conclusión que recoge el propósito.",
  ],
  [
    "Aplicación",
    "Hay un paso claro que la persona puede dar esa semana para crecer.",
  ],
  [
    "Lenguaje accesible",
    "Palabras sencillas, y el vocabulario espiritual se explica.",
  ],
  ["Conexión y voz", "Tono, ritmo y pausas, sin gritos ni monotonía."],
  ["Tiempo", "Se cumplieron los 45 minutos con cinco de margen."],
] as const;
export const escala = ["Necesita trabajo", "En camino", "Bien", "Muy bien"];
export const keys = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"] as const;
export type User = { id: string; nombre: string; admin: boolean };
export type Sermon = {
  id: string;
  fecha: string;
  predicador_id: string;
  titulo: string;
  pasaje: string;
  minutos?: number;
  creada_por: string;
  reabierta_hasta?: string;
  eliminada?: boolean;
};
export type Evaluation = Record<(typeof keys)[number], number> & {
  lo_que_mas_ayudo: string;
  un_ajuste: string;
  creada_en: string;
  actualizada_en: string;
};
export type SermonView = Sermon & {
  estado: string;
  editable: boolean;
  dias_restantes: number;
  reporte_listo: boolean;
  evaluada_por_mi: boolean;
  completadas?: string[];
};
export type Report = {
  predicacion: Sermon;
  predicador: string;
  promedios: (number | null)[];
  autoevaluacion: (number | null)[];
  lo_que_mas_ayudo: string[];
  un_ajuste: string[];
  cantidad: number;
};
export type Patterns = {
  trimestre: string;
  anterior: string;
  equipo: (number | null)[];
  cambio: (number | null)[];
  propios: (number | null)[];
  cantidad: number;
};
