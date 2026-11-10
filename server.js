const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ADMIN_USUARIO = process.env.ADMIN_USUARIO || "admin";
const ADMIN_CLAVE = process.env.ADMIN_CLAVE || "123";
const ARCHIVO = path.join(__dirname, "data", "datos.json");
const PUBLIC = path.join(__dirname, "public");
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const CONFIG = {
  sedes: ["MHE", "Rafael Núñez"],
  turnos: {
    T1: { nombre: "Turno T1", totalHoras: "42,00", horario: ["06:00 - 11:00 / 12:00 - 14:30", "06:00 - 11:00 / 12:00 - 14:30", "06:00 - 11:00 / 12:00 - 14:30", "06:00 - 11:00 / 12:00 - 14:30", "06:00 - 11:00 / 12:00 - 14:30", "06:30 - 11:00"] },
    T2: { nombre: "Turno T2", totalHoras: "37,50", horario: ["11:30 - 16:00 / 17:00 - 20:00", "11:30 - 16:00 / 17:00 - 20:00", "11:30 - 16:00 / 17:00 - 20:00", "11:30 - 16:00 / 17:00 - 20:00", "11:30 - 16:00 / 17:00 - 20:00", "DESCANSA"] },
    T3: { nombre: "Turno T3", totalHoras: "42,00", horario: ["08:00 - 12:00 / 13:30 - 17:00", "08:00 - 12:00 / 13:30 - 17:00", "08:00 - 12:00 / 13:30 - 17:00", "08:00 - 12:00 / 13:30 - 17:00", "08:00 - 12:00 / 13:30 - 17:00", "10:30 - 13:00 / 14:00 - 16:00"] }
  }
};

/* ---------- Datos (archivo JSON) ---------- */
fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });
if (!fs.existsSync(ARCHIVO)) fs.writeFileSync(ARCHIVO, JSON.stringify({ personal: [], registros: [] }));
const leer = () => {
  const d = JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
  const equivalencias = { A: "T1", B: "T3", C: "T2", D: "T2" };
  d.personal = d.personal.map(p => equivalencias[p.turno] ? { ...p, turno: equivalencias[p.turno] } : p);
  return d;
};
const guardar = d => fs.writeFileSync(ARCHIVO, JSON.stringify(d, null, 2));

/* ---------- Utilidades ---------- */
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const cuerpo = req => new Promise(ok => {
  let b = "";
  req.on("data", c => (b += c));
  req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } });
});
const fechaActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const esAdmin = req =>
  req.headers["x-usuario"] === ADMIN_USUARIO && req.headers["x-clave"] === ADMIN_CLAVE;

/* ---------- API ---------- */
async function api(req, res, url) {
  const d = leer();
  const m = req.method;

  if (url === "/api/config" && m === "GET") return json(res, 200, CONFIG);
  if (url === "/api/personal" && m === "GET") return json(res, 200, d.personal);
  if (url === "/api/registros" && m === "GET") return json(res, 200, d.registros);
  if (url === "/api/login" && m === "POST")
    return esAdmin(req) ? json(res, 200, { ok: true }) : json(res, 401, { error: "Usuario o contraseña incorrectos" });

  if (url === "/api/personal" && m === "POST") {
    if (!esAdmin(req)) return json(res, 401, { error: "No autorizado" });
    const b = await cuerpo(req);
    if (!b.nombre || !CONFIG.sedes.includes(b.sede) || !CONFIG.turnos[b.turno]) return json(res, 400, { error: "Nombre, sede o turno inválido" });
    if (d.personal.some(p => p.nombre.toLowerCase() === String(b.nombre).trim().toLowerCase() && p.sede === b.sede))
      return json(res, 409, { error: "Esa persona ya está registrada en esa sede" });
    const p = { id: "p" + Date.now().toString(36), nombre: String(b.nombre).trim(), sede: b.sede, turno: b.turno };
    d.personal.push(p); guardar(d);
    return json(res, 201, p);
  }

  if (url.startsWith("/api/personal/") && m === "DELETE") {
    if (!esAdmin(req)) return json(res, 401, { error: "No autorizado" });
    const id = url.split("/").pop();
    d.personal = d.personal.filter(p => p.id !== id); guardar(d);
    return json(res, 200, { ok: true });
  }

  if (url.startsWith("/api/personal/") && m === "PUT") {
    if (!esAdmin(req)) return json(res, 401, { error: "No autorizado" });
    const id = url.split("/").pop();
    const persona = d.personal.find(p => p.id === id);
    if (!persona) return json(res, 404, { error: "Persona no encontrada" });
    const b = await cuerpo(req);
    const nombre = String(b.nombre || "").trim();
    if (!nombre || !CONFIG.sedes.includes(b.sede) || !CONFIG.turnos[b.turno])
      return json(res, 400, { error: "Nombre, sede o turno inválido" });
    if (d.personal.some(p => p.id !== id && p.sede === b.sede && p.nombre.toLowerCase() === nombre.toLowerCase()))
      return json(res, 409, { error: "Esa persona ya está registrada en esa sede" });
    persona.nombre = nombre;
    persona.sede = b.sede;
    persona.turno = b.turno;
    guardar(d);
    return json(res, 200, persona);
  }

  if (url === "/api/registros" && m === "POST") {
    const b = await cuerpo(req);
    const persona = d.personal.find(p => p.id === b.personalId);
    if (!persona || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha)) || b.fecha !== fechaActual())
      return json(res, 400, { error: "Persona o fecha inválida" });
    const dia = new Date(`${b.fecha}T12:00:00`).getDay();
    const turno = CONFIG.turnos[persona.turno];
    if (!turno) return json(res, 400, { error: "La persona no tiene un turno válido asignado" });
    const horario = dia >= 1 && dia <= 6 ? turno.horario[dia - 1] : "DESCANSA";
    if (horario === "DESCANSA") return json(res, 400, { error: "La persona no tiene jornada asignada para este día" });
    if (d.registros.some(r => r.fecha === b.fecha && r.personalId === b.personalId))
      return json(res, 409, { error: "Ya registraste tu inicio hoy" });
    const ahora = new Date();
    const minutos = ahora.getHours() * 60 + ahora.getMinutes();
    const inicio = Number(horario.slice(0, 5).split(":")[0]) * 60 + Number(horario.slice(0, 5).split(":")[1]);
    const horaServidor = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
    const registro = { fecha: b.fecha, personalId: persona.id, nombre: persona.nombre, sede: persona.sede, turno: persona.turno, horario, hora: horaServidor, estado: minutos > inicio + 10 ? "Tarde" : "A tiempo" };
    d.registros.push(registro); guardar(d);
    return json(res, 201, registro);
  }

  json(res, 404, { error: "No existe" });
}

/* ---------- Archivos estáticos (carpeta public/) ---------- */
function estatico(req, res, url) {
  const archivo = url === "/" ? "index.html" : url === "/admin" || url === "/admin/" ? "admin.html" : url;
  const ruta = path.join(PUBLIC, archivo);
  if (!ruta.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(ruta, (e, data) => {
    if (e) { res.writeHead(404); return res.end("No encontrado"); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(ruta)] || "application/octet-stream" });
    res.end(data);
  });
}

/* ---------- Arranque del servidor ---------- */
http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url.startsWith("/api/")) api(req, res, url).catch(() => json(res, 500, { error: "Error del servidor" }));
  else estatico(req, res, url);
}).listen(PORT, () => console.log(`Servidor listo en http://localhost:${PORT}`));