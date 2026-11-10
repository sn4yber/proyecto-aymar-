const fs = require("node:fs");
const path = require("node:path");

const ADMIN_USUARIO = process.env.ADMIN_USUARIO || "admin";
const ADMIN_CLAVE = process.env.ADMIN_CLAVE || "123";
const DATA_FILE = path.join(process.cwd(), "data", "datos.json");
const BLOB_KEY = "jornadapro/datos.json";

const CONFIG = {
  sedes: ["MHE", "Rafael Núñez"],
  turnos: {
    T1: { nombre: "Turno T1", totalHoras: "42,00", horario: ["06:00 - 11:00 / 12:00 - 14:30", "06:00 - 11:00 / 12:00 - 14:30", "06:00 - 11:00 / 12:00 - 14:30", "06:00 - 11:00 / 12:00 - 14:30", "06:00 - 11:00 / 12:00 - 14:30", "06:30 - 11:00"] },
    T2: { nombre: "Turno T2", totalHoras: "37,50", horario: ["11:30 - 16:00 / 17:00 - 20:00", "11:30 - 16:00 / 17:00 - 20:00", "11:30 - 16:00 / 17:00 - 20:00", "11:30 - 16:00 / 17:00 - 20:00", "11:30 - 16:00 / 17:00 - 20:00", "DESCANSA"] },
    T3: { nombre: "Turno T3", totalHoras: "42,00", horario: ["08:00 - 12:00 / 13:30 - 17:00", "08:00 - 12:00 / 13:30 - 17:00", "08:00 - 12:00 / 13:30 - 17:00", "08:00 - 12:00 / 13:30 - 17:00", "08:00 - 12:00 / 13:30 - 17:00", "10:30 - 13:00 / 14:00 - 16:00"] }
  }
};

const response = (res, status, body) => res.status(status).json(body);
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const isAdmin = req =>
  req.headers["x-usuario"] === ADMIN_USUARIO && req.headers["x-clave"] === ADMIN_CLAVE;

function normalize(data) {
  const equivalences = { A: "T1", B: "T3", C: "T2", D: "T2" };
  data.personal = (data.personal || []).map(person =>
    equivalences[person.turno] ? { ...person, turno: equivalences[person.turno] } : person);
  data.registros = data.registros || [];
  return data;
}

async function blobStore() {
  return import("@vercel/blob");
}

async function readData() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return normalize(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
  }
  try {
    const { head } = await blobStore();
    const metadata = await head(BLOB_KEY);
    return normalize(await (await fetch(metadata.url)).json());
  } catch (error) {
    if (error.statusCode !== 404 && error.code !== "BLOB_NOT_FOUND") throw error;
    return { personal: [], registros: [] };
  }
}

async function writeData(data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw Object.assign(new Error("Configura BLOB_READ_WRITE_TOKEN en Vercel para guardar cambios"), { status: 503 });
  }
  const { put } = await blobStore();
  await put(BLOB_KEY, JSON.stringify(data, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
}

function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return {};
}

module.exports = async function handler(req, res) {
  const route = Array.isArray(req.query.path) ? req.query.path.join("/") : String(req.query.path || "");
  const url = `/api/${route}`;
  const data = await readData();

  if (url === "/api/config" && req.method === "GET") return response(res, 200, CONFIG);
  if (url === "/api/personal" && req.method === "GET") return response(res, 200, data.personal);
  if (url === "/api/registros" && req.method === "GET") return response(res, 200, data.registros);
  if (url === "/api/login" && req.method === "POST") {
    return isAdmin(req)
      ? response(res, 200, { ok: true })
      : response(res, 401, { error: "Usuario o contraseña incorrectos" });
  }

  if (url === "/api/personal" && req.method === "POST") {
    if (!isAdmin(req)) return response(res, 401, { error: "No autorizado" });
    const body = requestBody(req);
    const name = String(body.nombre || "").trim();
    if (!name || !CONFIG.sedes.includes(body.sede) || !CONFIG.turnos[body.turno])
      return response(res, 400, { error: "Nombre, sede o turno inválido" });
    if (data.personal.some(person => person.nombre.toLowerCase() === name.toLowerCase() && person.sede === body.sede))
      return response(res, 409, { error: "Esa persona ya está registrada en esa sede" });
    const person = { id: `p${Date.now().toString(36)}`, nombre: name, sede: body.sede, turno: body.turno };
    data.personal.push(person);
    await writeData(data);
    return response(res, 201, person);
  }

  const personMatch = url.match(/^\/api\/personal\/([^/]+)$/);
  if (personMatch && (req.method === "PUT" || req.method === "DELETE")) {
    if (!isAdmin(req)) return response(res, 401, { error: "No autorizado" });
    const id = decodeURIComponent(personMatch[1]);
    const index = data.personal.findIndex(person => person.id === id);
    if (index < 0) return response(res, 404, { error: "Persona no encontrada" });
    if (req.method === "DELETE") {
      data.personal.splice(index, 1);
      await writeData(data);
      return response(res, 200, { ok: true });
    }
    const body = requestBody(req);
    const name = String(body.nombre || "").trim();
    if (!name || !CONFIG.sedes.includes(body.sede) || !CONFIG.turnos[body.turno])
      return response(res, 400, { error: "Nombre, sede o turno inválido" });
    if (data.personal.some(person => person.id !== id && person.nombre.toLowerCase() === name.toLowerCase() && person.sede === body.sede))
      return response(res, 409, { error: "Esa persona ya está registrada en esa sede" });
    data.personal[index] = { ...data.personal[index], nombre: name, sede: body.sede, turno: body.turno };
    await writeData(data);
    return response(res, 200, data.personal[index]);
  }

  if (url === "/api/registros" && req.method === "POST") {
    const body = requestBody(req);
    const person = data.personal.find(item => item.id === body.personalId);
    if (!person || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha)) || body.fecha !== today())
      return response(res, 400, { error: "Persona o fecha inválida" });
    const day = new Date(`${body.fecha}T12:00:00`).getDay();
    const shift = CONFIG.turnos[person.turno];
    const schedule = day >= 1 && day <= 6 ? shift?.horario[day - 1] : "DESCANSA";
    if (!shift || schedule === "DESCANSA")
      return response(res, 400, { error: "La persona no tiene jornada asignada para este día" });
    if (data.registros.some(record => record.fecha === body.fecha && record.personalId === person.id))
      return response(res, 409, { error: "Ya registraste tu inicio hoy" });
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const start = Number(schedule.slice(0, 2)) * 60 + Number(schedule.slice(3, 5));
    const hour = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const record = {
      fecha: body.fecha, personalId: person.id, nombre: person.nombre, sede: person.sede,
      turno: person.turno, horario: schedule, hora: hour, estado: minutes > start + 10 ? "Tarde" : "A tiempo"
    };
    data.registros.push(record);
    await writeData(data);
    return response(res, 201, record);
  }

  return response(res, 404, { error: "No existe" });
};
