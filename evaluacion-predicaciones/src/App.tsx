import { useEffect, useState, type FormEvent } from "react";
import {
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Plus,
  LogOut,
  LockKeyhole,
  CalendarDays,
  Clock3,
  Check,
  Printer,
  ChartNoAxesCombined,
  ShieldCheck,
  Pencil,
  Trash2,
  RotateCcw,
  X,
  ChevronRight,
} from "lucide-react";
import { api, ApiError, isDemo } from "./api";
import {
  criterios,
  escala,
  keys,
  type User,
  type Sermon,
  type SermonView,
  type Evaluation,
  type Report,
  type Patterns,
} from "../shared/model";
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date + "T12:00:00"));
const currentQuarter = () =>
  `${new Date().getFullYear()}-T${Math.ceil((new Date().getMonth() + 1) / 3)}`;
const number = (n: number | null) =>
  n === null
    ? "—"
    : n.toLocaleString("es", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 1,
      });
type Screen = {
  name: "inicio" | "patrones" | "admin" | "evaluar" | "reporte";
  sermon?: SermonView;
};
export default function App() {
  const [usuarios, setUsuarios] = useState<User[]>([]),
    [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [screen, setScreen] = useState<Screen>({ name: "inicio" }),
    [sermons, setSermons] = useState<SermonView[]>([]),
    [editing, setEditing] = useState<Sermon | null | false>(false),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    const data = await api<{ predicaciones: SermonView[] }>("sermons");
    setSermons(data.predicaciones);
  };
  const initialize = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ usuarios: User[] }>("users");
      setUsuarios(data.usuarios);
      try {
        const s = await api("session");
        setUser(s.usuario || null);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401) && !isDemo) throw e;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void initialize();
  }, []);
  useEffect(() => {
    if (user) {
      setLoading(true);
      load()
        .catch((e) => handleError(e))
        .finally(() => setLoading(false));
    }
  }, [user]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function handleError(e: unknown) {
    setError((e as Error).message);
    if (e instanceof ApiError && e.status === 401) {
      setUser(null);
      setScreen({ name: "inicio" });
    }
  }
  async function mutate(action: string, options: any, message: string) {
    setBusy(true);
    setError("");
    try {
      await api(action, options);
      await load();
      setToast(message);
      return true;
    } catch (e) {
      handleError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function navigate(s: Screen) {
    setScreen(s);
    setError("");
    window.scrollTo({ top: 0 });
  }
  const name = (id: string) =>
    usuarios.find((u) => u.id === id)?.nombre || "Predicador";
  const evaluated = sermons.filter((s) => s.evaluada_por_mi).length;
  return (
    <>
      {isDemo && (
        <div className="demo no-print">
          Demostración local · datos ficticios en memoria · usa cualquier PIN de
          6 dígitos
        </div>
      )}
      {!user ? (
        <main className="login-layout">
          <aside className="login-story">
            <Brand light />
            <div>
              <span className="eyebrow">UN ESPACIO PARA CRECER JUNTOS</span>
              <h1>
                Servimos mejor
                <br />
                cuando aprendemos
                <br />
                <em>a escucharnos.</em>
              </h1>
              <p>
                Una mirada honesta a lo que predicamos, con el cuidado y la
                confianza de nuestro equipo.
              </p>
              <div className="story-line" />
              <small>IGLESIA VIDA REAL</small>
            </div>
            <span className="login-foot">
              <LockKeyhole size={16} /> Un espacio privado para nuestro equipo.
            </span>
          </aside>
          <section className="login-form">
            <div className="mobile-brand">
              <Brand />
            </div>
            <span className="eyebrow">BIENVENIDO</span>
            <h2>Evaluación de predicaciones</h2>
            <p className="muted">Selecciona tu nombre para entrar.</p>
            {error && <ErrorBox error={error} />}{" "}
            {loading ? (
              <Loading />
            ) : usuarios.length ? (
              <Login
                usuarios={usuarios}
                onLogin={(u) => {
                  setUser(u);
                  setError("");
                }}
              />
            ) : (
              <button onClick={initialize}>Volver a intentar</button>
            )}
            <p className="privacy-note">
              <ShieldCheck size={18} /> Tus evaluaciones personales permanecen
              privadas. Los reportes reúnen las aportaciones sin mostrar
              nombres.
            </p>
          </section>
        </main>
      ) : (
        <>
          <header className="site-header no-print">
            <div className="header-inner">
              <Brand />
              <nav aria-label="Navegación principal">
                {(
                  [
                    "inicio",
                    "patrones",
                    ...(user.admin ? ["admin"] : []),
                  ] as const
                ).map((n) => (
                  <button
                    key={n}
                    className={`nav-link ${screen.name === n ? "active" : ""}`}
                    onClick={() => navigate({ name: n as Screen["name"] })}
                  >
                    {n === "inicio"
                      ? "Predicaciones"
                      : n === "patrones"
                        ? "Patrones del trimestre"
                        : "Administración"}
                  </button>
                ))}
              </nav>
              <button
                className="profile"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("logout", { method: "POST" });
                    setUser(null);
                    setSermons([]);
                    setScreen({ name: "inicio" });
                  } catch (e) {
                    handleError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                aria-label="Cerrar sesión"
              >
                <span className="avatar">{user.nombre.charAt(0)}</span>
                <span>{user.nombre.split(" ")[0]}</span>
                <LogOut size={17} />
              </button>
            </div>
          </header>
          <main
            className={`page ${screen.name === "reporte" ? "report-page" : ""}`}
          >
            {error && <ErrorBox error={error} onClose={() => setError("")} />}
            {loading ? (
              <Loading />
            ) : (
              <>
                {(screen.name === "inicio" || screen.name === "admin") && (
                  <>
                    <div className="page-heading no-print">
                      <div>
                        <span className="eyebrow">
                          {screen.name === "admin"
                            ? "CUIDADO DEL EQUIPO"
                            : "IGLESIA VIDA REAL"}
                        </span>
                        <h1>
                          {screen.name === "admin"
                            ? "Administración"
                            : "Cada mensaje, una oportunidad para crecer."}
                        </h1>
                        <p className="muted">
                          {screen.name === "admin"
                            ? "Acompaña la participación y administra las predicaciones."
                            : "Evalúa con honestidad. Recibe con humildad. Sigamos aprendiendo juntos."}
                        </p>
                      </div>
                      <button onClick={() => setEditing(null)}>
                        <Plus size={19} /> Nueva predicación
                      </button>
                    </div>
                    {screen.name === "inicio" && (
                      <section className="overview no-print">
                        <div>
                          <span className="overview-icon">
                            <BookOpen />
                          </span>
                          <div>
                            <strong>{sermons.length}</strong>
                            <span>Predicaciones registradas</span>
                          </div>
                        </div>
                        <div>
                          <span className="overview-icon">
                            <Check />
                          </span>
                          <div>
                            <strong>{evaluated}</strong>
                            <span>Evaluadas por ti</span>
                          </div>
                        </div>
                        <div className="overview-note">
                          <ShieldCheck />
                          <span>
                            Evaluamos para acompañarnos.
                            <br />
                            <b>La confianza es parte del proceso.</b>
                          </span>
                        </div>
                      </section>
                    )}
                    <section className="list-section">
                      <div className="section-label">
                        <h2>
                          {screen.name === "admin"
                            ? "Participación del equipo"
                            : "Predicaciones recientes"}
                        </h2>
                        <span>{sermons.length} mensajes</span>
                      </div>
                      {!sermons.length ? (
                        <div className="empty">
                          <BookOpen size={35} />
                          <h2>Comencemos con una predicación</h2>
                          <p>
                            Registra la fecha, el predicador y el pasaje para
                            que el equipo pueda evaluar.
                          </p>
                          <button onClick={() => setEditing(null)}>
                            <Plus size={18} /> Nueva predicación
                          </button>
                        </div>
                      ) : (
                        sermons.map((s) => (
                          <article className="sermon-card" key={s.id}>
                            <div className="sermon-date">
                              <b>{new Date(s.fecha + "T12:00:00").getDate()}</b>
                              <span>
                                {new Date(s.fecha + "T12:00:00")
                                  .toLocaleString("es", { month: "short" })
                                  .replace(".", "")}
                              </span>
                            </div>
                            <div className="sermon-body">
                              <div className="sermon-meta">
                                {name(s.predicador_id)}{" "}
                                {s.predicador_id === user.id && (
                                  <span className="own-label">
                                    Tú predicaste
                                  </span>
                                )}
                              </div>
                              <h3>{s.titulo}</h3>
                              <p>
                                {s.pasaje}
                                <span>·</span>
                                {formatDate(s.fecha)}
                                {s.minutos && (
                                  <>
                                    <span>·</span>
                                    {s.minutos} min
                                  </>
                                )}
                              </p>
                              {screen.name === "admin" && (
                                <div className="completion">
                                  {usuarios.map((u) => (
                                    <span
                                      key={u.id}
                                      className={
                                        s.completadas?.includes(u.id)
                                          ? "done"
                                          : ""
                                      }
                                    >
                                      {s.completadas?.includes(u.id) ? (
                                        <Check size={13} />
                                      ) : (
                                        <Clock3 size={13} />
                                      )}{" "}
                                      {u.nombre}
                                      {u.id === s.predicador_id
                                        ? " (auto)"
                                        : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="card-actions">
                              <span
                                className={`status ${s.estado === "Reporte listo" ? "ready" : s.estado === "Evaluada" ? "complete" : "pending"}`}
                              >
                                {s.estado === "Evaluada" && <Check size={13} />}{" "}
                                {s.estado}
                              </span>
                              {screen.name === "admin" ? (
                                <div className="admin-actions">
                                  <button
                                    className="secondary"
                                    title="Reabrir por siete días"
                                    onClick={() =>
                                      mutate(
                                        "reopen",
                                        { method: "POST", id: s.id },
                                        "Evaluaciones reabiertas por siete días.",
                                      )
                                    }
                                    disabled={busy}
                                  >
                                    <RotateCcw size={16} /> Reabrir
                                  </button>
                                  <button
                                    className="icon-button"
                                    aria-label={`Editar ${s.titulo}`}
                                    onClick={() => setEditing(s)}
                                  >
                                    <Pencil size={18} />
                                  </button>
                                  <DeleteButton
                                    busy={busy}
                                    onDelete={() =>
                                      mutate(
                                        "sermon",
                                        { method: "DELETE", id: s.id },
                                        "Predicación eliminada.",
                                      )
                                    }
                                  />
                                </div>
                              ) : (
                                <div className="action-row">
                                  <button
                                    className={
                                      s.reporte_listo
                                        ? "secondary"
                                        : "text-button"
                                    }
                                    onClick={() =>
                                      navigate({ name: "evaluar", sermon: s })
                                    }
                                  >
                                    {s.predicador_id === user.id
                                      ? "Mi autoevaluación"
                                      : s.estado === "Evaluada"
                                        ? "Ver evaluación"
                                        : s.editable
                                          ? "Evaluar"
                                          : "Ver evaluación"}
                                    <ChevronRight size={16} />
                                  </button>
                                  {s.reporte_listo && (
                                    <button
                                      onClick={() =>
                                        navigate({ name: "reporte", sermon: s })
                                      }
                                    >
                                      Mi reporte
                                      <ArrowRight size={16} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </article>
                        ))
                      )}
                    </section>
                    <div className="guidance no-print">
                      <Clock3 size={18} />
                      <p>
                        Puedes completar y editar tu evaluación hasta siete días
                        después de la predicación. Después, el administrador
                        puede reabrir el período.
                      </p>
                    </div>
                  </>
                )}
                {screen.name === "evaluar" && screen.sermon && (
                  <Evaluate
                    sermon={screen.sermon}
                    own={screen.sermon.predicador_id === user.id}
                    onBack={() => navigate({ name: "inicio" })}
                    onError={handleError}
                    onSave={async () => {
                      await load();
                      setToast("Tu evaluación quedó guardada.");
                      navigate({ name: "inicio" });
                    }}
                  />
                )}
                {screen.name === "reporte" && screen.sermon && (
                  <ReportPage
                    id={screen.sermon.id}
                    onBack={() => navigate({ name: "inicio" })}
                    onError={handleError}
                  />
                )}
                {screen.name === "patrones" && (
                  <PatternsPage onError={handleError} />
                )}
              </>
            )}
            <footer className="footer no-print">
              <span>IGLESIA VIDA REAL</span>
              <span>Evaluación de predicaciones · Un equipo que aprende.</span>
            </footer>
          </main>
          {editing !== false && (
            <SermonForm
              initial={editing}
              error={error}
              usuarios={usuarios}
              user={user}
              busy={busy}
              onClose={() => setEditing(false)}
              onSave={async (b) => {
                if (
                  await mutate(
                    editing ? "sermon" : "sermons",
                    {
                      method: editing ? "PUT" : "POST",
                      id: editing?.id,
                      body: b,
                    },
                    editing
                      ? "Predicación actualizada."
                      : "Predicación registrada.",
                  )
                )
                  setEditing(false);
              }}
            />
          )}
        </>
      )}
      {toast && (
        <div className="toast no-print" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "light" : ""}`}>
      <span className="brand-mark">
        <BookOpen size={23} />
      </span>
      <span>
        vida real<small>EVALUACIÓN DE PREDICACIONES</small>
      </span>
    </div>
  );
}
function ErrorBox({ error, onClose }: { error: string; onClose?: () => void }) {
  return (
    <div className="error no-print" role="alert">
      <span>{error}</span>
      {onClose && (
        <button
          className="icon-button"
          aria-label="Cerrar aviso"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      )}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" /> Cargando…
    </div>
  );
}
function Login({
  usuarios,
  onLogin,
}: {
  usuarios: User[];
  onLogin: (u: User) => void;
}) {
  const [id, setId] = useState(""),
    [pin, setPin] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const data = await api("login", {
            method: "POST",
            body: { id, pin },
          });
          setPin("");
          onLogin(data.usuario);
        } catch (e) {
          setError((e as Error).message);
          setPin("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div
        className="user-options"
        role="group"
        aria-label="Selecciona tu nombre"
      >
        {usuarios.map((u, i) => (
          <button
            type="button"
            aria-pressed={id === u.id}
            className={`user-option ${id === u.id ? "selected" : ""}`}
            key={u.id}
            onClick={() => {
              setId(u.id);
              setPin("");
              setError("");
            }}
          >
            <span className={`avatar color-${i}`}>{u.nombre.charAt(0)}</span>
            <span>{u.nombre}</span>
            {id === u.id ? <Check size={18} /> : <ChevronRight size={18} />}
          </button>
        ))}
      </div>
      {id && (
        <div className="pin-area">
          <label htmlFor="pin">Tu PIN de acceso</label>
          <input
            id="pin"
            autoFocus
            type="password"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required
            placeholder="••••••"
          />
          <small>6 dígitos · acceso personal</small>
        </div>
      )}
      {error && <ErrorBox error={error} />}
      <button className="full" disabled={busy || !id || pin.length !== 6}>
        {busy ? "Entrando…" : "Entrar a mi espacio"}
        <ArrowRight size={18} />
      </button>
      {isDemo && (
        <button
          type="button"
          className="secondary full demo-entry"
          onClick={async () => {
            const d = await api("demo-enter");
            onLogin(d.usuario);
          }}
        >
          Explorar la demostración sin PIN
        </button>
      )}
    </form>
  );
}
function SermonForm({
  initial,
  usuarios,
  user,
  busy,
  onClose,
  onSave,
  error,
}: {
  error: string;
  initial: Sermon | null;
  usuarios: User[];
  user: User;
  busy: boolean;
  onClose: () => void;
  onSave: (b: any) => void;
}) {
  const [form, setForm] = useState({
    fecha: initial?.fecha || new Date().toLocaleDateString("en-CA"),
    predicador_id: initial?.predicador_id || user.id,
    titulo: initial?.titulo || "",
    pasaje: initial?.pasaje || "",
    minutos: initial?.minutos?.toString() || "",
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", listener);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const nodes = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input, select",
              ),
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <button
          className="modal-close icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Cerrar"
        >
          <X />
        </button>
        <span className="eyebrow">REGISTRO DEL MENSAJE</span>
        <h2 id="modal-title">
          {initial ? "Editar predicación" : "Nueva predicación"}
        </h2>
        <p className="muted">Un punto de partida para escuchar al equipo.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              ...form,
              minutos: form.minutos ? Number(form.minutos) : undefined,
            });
          }}
        >
          <label>
            Fecha
            <input
              autoFocus
              required
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
          </label>
          <label>
            Predicador
            <select
              value={form.predicador_id}
              onChange={(e) =>
                setForm({ ...form, predicador_id: e.target.value })
              }
            >
              {usuarios.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Título del mensaje
            <input
              required
              maxLength={140}
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="¿Cómo se titula la predicación?"
            />
          </label>
          <label>
            Pasaje bíblico
            <input
              required
              maxLength={160}
              value={form.pasaje}
              onChange={(e) => setForm({ ...form, pasaje: e.target.value })}
              placeholder="Por ejemplo: Efesios 2:1–10"
            />
          </label>
          <label>
            Tiempo real, en minutos <span className="muted">(opcional)</span>
            <input
              type="number"
              min={1}
              max={300}
              step={1}
              value={form.minutos}
              onChange={(e) => setForm({ ...form, minutos: e.target.value })}
              placeholder="45"
            />
          </label>
          {error && <ErrorBox error={error} />}
          <div className="modal-buttons">
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button disabled={busy}>
              {busy
                ? "Guardando…"
                : initial
                  ? "Guardar cambios"
                  : "Crear predicación"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function DeleteButton({
  busy,
  onDelete,
}: {
  busy: boolean;
  onDelete: () => Promise<boolean>;
}) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="delete-confirm">
      <span>¿Eliminar?</span>
      <button
        disabled={busy}
        className="danger"
        onClick={async () => {
          await onDelete();
          setConfirm(false);
        }}
      >
        Sí
      </button>
      <button className="secondary" onClick={() => setConfirm(false)}>
        No
      </button>
    </div>
  ) : (
    <button
      className="icon-button"
      aria-label="Eliminar predicación"
      onClick={() => setConfirm(true)}
    >
      <Trash2 size={18} />
    </button>
  );
}
function Evaluate({
  sermon,
  own,
  onBack,
  onSave,
  onError,
}: {
  sermon: SermonView;
  own: boolean;
  onBack: () => void;
  onSave: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState<Partial<Evaluation>>({
      lo_que_mas_ayudo: "",
      un_ajuste: "",
    }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(false),
    [window, setWindow] = useState({
      editable: sermon.editable,
      dias_restantes: sermon.dias_restantes,
    });
  useEffect(() => {
    api("evaluation", { id: sermon.id })
      .then((d) => {
        setForm(d.evaluacion || { lo_que_mas_ayudo: "", un_ajuste: "" });
        setWindow(d);
      })
      .catch((e) => {
        setLoadError(true);
        onError(e);
      })
      .finally(() => setLoading(false));
  }, [sermon.id]);
  const count = keys.filter((k) => form[k]).length;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (count !== 7) {
      setError("Selecciona una puntuación en los siete criterios.");
      document
        .querySelector(`[data-criterion="${keys.find((k) => !form[k])}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("evaluation", { id: sermon.id, method: "PUT", body: form });
      await onSave();
    } catch (e) {
      setError((e as Error).message);
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="narrow">
      <button className="back no-print" onClick={onBack}>
        <ArrowLeft size={17} /> Volver a predicaciones
      </button>
      <span className="eyebrow">
        {own ? "UNA MIRADA A MI MENSAJE" : "ESCUCHAR Y ACOMPAÑAR"}
      </span>
      <h1>{own ? "Mi autoevaluación" : "Evaluar predicación"}</h1>
      <div className="evaluation-summary">
        <h2>{sermon.titulo}</h2>
        <p>
          {sermon.pasaje} · {formatDate(sermon.fecha)}
        </p>
        <span className={window.editable ? "deadline" : "deadline closed"}>
          <Clock3 size={16} />
          {window.editable
            ? window.dias_restantes === 0
              ? "Último día para editar"
              : `${window.dias_restantes} ${window.dias_restantes === 1 ? "día restante" : "días restantes"} para editar`
            : "Evaluación cerrada"}
        </span>
      </div>
      {loading ? (
        <Loading />
      ) : loadError ? (
        <p className="empty-inline">
          No se pudo cargar tu evaluación. Vuelve a la lista e inténtalo de
          nuevo.
        </p>
      ) : (
        <form onSubmit={submit}>
          <div className="evaluation-intro">
            <p>
              {window.editable
                ? "Elige una respuesta por criterio y añade dos observaciones concretas."
                : "Puedes consultar tu evaluación. Para realizar cambios, solicita al administrador que reabra el período."}
            </p>
            <span>{count} de 7</span>
          </div>
          <div className="progress">
            <div style={{ width: `${(count / 7) * 100}%` }} />
          </div>
          {criterios.map(([title, description], i) => {
            const k = keys[i];
            return (
              <fieldset
                className="criterion"
                key={k}
                data-criterion={k}
                disabled={!window.editable || busy}
              >
                <legend>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {title}
                </legend>
                <p>{description}</p>
                <div
                  className="score-options"
                  role="radiogroup"
                  aria-label={title}
                >
                  {escala.map((label, j) => (
                    <label
                      key={label}
                      className={form[k] === j + 1 ? "chosen" : ""}
                    >
                      <input
                        type="radio"
                        name={k}
                        value={j + 1}
                        checked={form[k] === j + 1}
                        onChange={() => setForm({ ...form, [k]: j + 1 })}
                      />
                      <b>{j + 1}</b>
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <section className="observations">
            <span className="eyebrow">UNA OBSERVACIÓN CONCRETA</span>
            <label>
              Lo que más ayudó
              <input
                maxLength={180}
                required
                disabled={!window.editable || busy}
                value={form.lo_que_mas_ayudo || ""}
                onChange={(e) =>
                  setForm({ ...form, lo_que_mas_ayudo: e.target.value })
                }
                placeholder="Una idea, explicación o momento que te ayudó."
              />
            </label>
            <label>
              Un solo ajuste para la próxima vez
              <input
                maxLength={180}
                required
                disabled={!window.editable || busy}
                value={form.un_ajuste || ""}
                onChange={(e) =>
                  setForm({ ...form, un_ajuste: e.target.value })
                }
                placeholder="Un cambio específico que pueda poner en práctica."
              />
            </label>
            <small>
              Máximo 180 caracteres por campo. Evita incluir nombres u otros
              datos que te identifiquen.
            </small>
          </section>
          {error && <ErrorBox error={error} />}
          <div className="save-bar">
            <span>
              <LockKeyhole size={16} /> Solo tú puedes consultar esta
              evaluación.
            </span>
            {window.editable && (
              <button disabled={busy}>
                {busy ? "Guardando…" : "Guardar evaluación"}
                <Check size={18} />
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
function ReportPage({
  id,
  onBack,
  onError,
}: {
  id: string;
  onBack: () => void;
  onError: (e: unknown) => void;
}) {
  const [report, setReport] = useState<Report | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    api<Report>("report", { id })
      .then(setReport)
      .catch((e) => {
        setFailed(true);
        onError(e);
      });
  }, [id]);
  if (!report)
    return (
      <>
        <button className="back" onClick={onBack}>
          <ArrowLeft size={17} /> Volver
        </button>
        {failed ? (
          <p className="empty-inline">
            El reporte no está disponible. Consulta el aviso e inténtalo de
            nuevo.
          </p>
        ) : (
          <Loading />
        )}
      </>
    );
  return (
    <>
      <div className="report-toolbar no-print">
        <button className="back" onClick={onBack}>
          <ArrowLeft size={17} /> Volver a predicaciones
        </button>
        <button onClick={() => window.print()}>
          <Printer size={18} /> Imprimir o guardar PDF
        </button>
      </div>
      <article className="report">
        <header className="report-header">
          <span className="eyebrow">IGLESIA VIDA REAL · REPORTE PERSONAL</span>
          <h1>{report.predicacion.titulo}</h1>
          <p>
            {report.predicador} · {formatDate(report.predicacion.fecha)}
          </p>
          <div className="report-meta">
            <span>
              <BookOpen size={16} />
              {report.predicacion.pasaje}
            </span>
            {report.predicacion.minutos && (
              <span>
                <Clock3 size={16} />
                {report.predicacion.minutos} minutos reales
              </span>
            )}
          </div>
        </header>
        <div className="report-section-title">
          <h2>Lo que ve el equipo, lo que veo yo</h2>
          <span>{report.cantidad} evaluaciones de compañeros</span>
        </div>
        <div className="chart-legend">
          <span>
            <i className="dot blue" /> Promedio de compañeros
          </span>
          <span>
            <i className="dot ochre" /> Mi autoevaluación
          </span>
        </div>
        <div className="report-chart">
          {criterios.map(([title], i) => {
            const avg = report.promedios[i],
              own = report.autoevaluacion[i];
            return (
              <div className="report-chart-row" key={title}>
                <div className="chart-label">
                  <b>{title}</b>
                  <span>
                    {own !== null && avg !== null
                      ? `Diferencia: ${avg - own > 0 ? "+" : ""}${number(avg - own)}`
                      : "Sin autoevaluación"}
                  </span>
                </div>
                <div className="bar-pair">
                  <div>
                    <div className="bar-track">
                      <span
                        className="bar blue"
                        style={{ width: `${((avg || 0) / 4) * 100}%` }}
                      />
                    </div>
                    <b>{number(avg)}</b>
                  </div>
                  <div>
                    <div className="bar-track">
                      <span
                        className="bar ochre"
                        style={{ width: `${((own || 0) / 4) * 100}%` }}
                      />
                    </div>
                    <b>{number(own)}</b>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="chart-caption">
          Escala de 1 a 4. Diferencia = promedio de compañeros menos
          autoevaluación.
        </p>
        <div className="feedback-columns">
          <section>
            <h2>Lo que más ayudó</h2>
            <ul>
              {report.lo_que_mas_ayudo.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Un ajuste para la próxima vez</h2>
            <ul>
              {report.un_ajuste.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        </div>
        <footer className="report-foot">
          Aportaciones sin nombres y en orden aleatorio. Este reporte es privado
          para quien predicó.
        </footer>
      </article>
    </>
  );
}
function PatternsPage({ onError }: { onError: (e: unknown) => void }) {
  const [q, setQ] = useState(currentQuarter()),
    [data, setData] = useState<Patterns | null>(null),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    api<Patterns>("patterns", { quarter: q })
      .then((d) => {
        if (active) setData(d);
      })
      .catch(onError)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [q]);
  const [year, term] = q.split("-T");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">UNA MIRADA AL CAMINO RECORRIDO</span>
          <h1>Patrones del trimestre</h1>
          <p className="muted">
            Observemos dónde estamos creciendo como equipo.
          </p>
        </div>
        <div className="quarter-picker">
          <label>
            Año
            <select
              value={year}
              onChange={(e) => setQ(`${e.target.value}-T${term}`)}
            >
              {Array.from(
                { length: Math.max(5, new Date().getFullYear() - 2020 + 2) },
                (_, i) => 2020 + i,
              ).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label>
            Trimestre
            <select
              value={term}
              onChange={(e) => setQ(`${year}-T${e.target.value}`)}
            >
              {[1, 2, 3, 4].map((t) => (
                <option value={t} key={t}>
                  {t} · {["Ene–Mar", "Abr–Jun", "Jul–Sep", "Oct–Dic"][t - 1]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="pattern-note">
        <ChartNoAxesCombined size={22} />
        <p>
          Promedios de evaluaciones de compañeros, con el mismo peso por
          predicación. Solo se incluyen mensajes con al menos dos evaluaciones
          externas; las autoevaluaciones quedan fuera.
        </p>
      </div>
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="section-label">
              <h2>
                {data.cantidad}{" "}
                {data.cantidad === 1
                  ? "predicación incluida"
                  : "predicaciones incluidas"}
              </h2>
              <span>Cambio frente a {data.anterior}</span>
            </div>
            {!data.cantidad && (
              <p className="empty-inline">
                Todavía no hay predicaciones con suficientes evaluaciones en
                este trimestre.
              </p>
            )}
            <div className="pattern-grid">
              <section className="pattern-panel">
                <h2>El equipo</h2>
                <p className="muted">Promedio por criterio</p>
                {criterios.map(([title], i) => (
                  <div className="pattern-row" key={title}>
                    <div>
                      <b>{title}</b>
                      <span>
                        {number(data.equipo[i])}
                        <small
                          className={
                            data.cambio[i] !== null && data.cambio[i]! < 0
                              ? "negative"
                              : ""
                          }
                        >
                          {data.cambio[i] === null
                            ? "Sin comparación"
                            : `${data.cambio[i]! > 0 ? "+" : ""}${number(data.cambio[i])}`}
                        </small>
                      </span>
                    </div>
                    <div className="bar-track">
                      <span
                        className="bar blue"
                        style={{
                          width: `${((data.equipo[i] || 0) / 4) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </section>
              <section className="pattern-panel personal">
                <span className="eyebrow">SOLO VISIBLE PARA TI</span>
                <h2>Mis predicaciones</h2>
                <p className="muted">Cómo recibe el equipo mis mensajes</p>
                {criterios.map(([title], i) => (
                  <div className="pattern-row" key={title}>
                    <div>
                      <b>{title}</b>
                      <span>{number(data.propios[i])}</span>
                    </div>
                    <div className="bar-track">
                      <span
                        className="bar ochre"
                        style={{
                          width: `${((data.propios[i] || 0) / 4) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </section>
            </div>
            <p className="guidance">
              <ShieldCheck size={18} />
              Esta vista reúne promedios. No contiene comentarios ni
              evaluaciones individuales.
            </p>
          </>
        )
      )}
    </>
  );
}
