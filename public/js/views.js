import { appConfig } from "./config.js";
import { Datos } from "./data.js";
import { $, diaActual, esc, fechaHoy } from "./utils.js";

export const textoTurno = key => appConfig.turnos[key]?.nombre || "—";
export const horarioPersona = person => person && appConfig.turnos[person.turno]
  ? appConfig.turnos[person.turno].horario[diaActual()]
  : "—";

export function llenarSelects() {
  const options = appConfig.sedes.map(sede => `<option>${esc(sede)}</option>`).join("");
  if ($("#sede")) $("#sede").innerHTML = '<option value="">Elige una sede</option>' + options;
  if ($("#sede-nueva")) $("#sede-nueva").innerHTML = '<option value="">Elige una sede</option>' + options;
  if ($("#turno-nuevo")) $("#turno-nuevo").innerHTML = Object.keys(appConfig.turnos)
    .map(key => `<option value="${esc(key)}">${esc(textoTurno(key))}</option>`).join("");
}

export function personaElegida() {
  return Datos.personal().find(person => person.id === $("#persona").value);
}

export function actualizarPersonas() {
  const sede = $("#sede").value;
  const selected = $("#persona").value;
  const people = Datos.personal()
    .filter(person => person.sede === sede)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  $("#persona").disabled = !sede;
  $("#persona").innerHTML = '<option value="">Selecciona tu nombre</option>' +
    people.map(person => `<option value="${esc(person.id)}">${esc(person.nombre)}</option>`).join("");
  $("#persona").value = selected;
}

export function actualizarBoton() {
  const person = personaElegida();
  const already = person && Datos.registros().find(record =>
    record.fecha === fechaHoy() && record.personalId === person.id);
  const descanso = !person || horarioPersona(person) === "DESCANSA";
  $("#info-turno").textContent = person
    ? `${textoTurno(person.turno)} · Hoy: ${horarioPersona(person)}`
    : "Selecciona tu sede y tu nombre para consultar tu horario.";
  $("#info-turno").classList.remove("hide");
  $("#btn-registrar").disabled = !person || Boolean(already) || descanso;
  $("#btn-registrar").textContent = already
    ? `Ya registraste tu inicio (${already.hora})`
    : !person ? "Elige tu sede y tu nombre"
      : descanso ? "No hay jornada asignada hoy" : "Registrar inicio de jornada";
}

function tablaRegistros(fecha, sede = "") {
  const records = Datos.registros()
    .filter(record => record.fecha === fecha && (!sede || record.sede === sede))
    .sort((a, b) => a.hora.localeCompare(b.hora));
  if (!records.length) return '<p class="empty">Aún no hay registros.</p>';
  return `<div class="wrap"><table><thead><tr>
    <th>Nombre</th><th>Sede</th><th>Turno</th><th>Horario</th><th>Hora</th><th>Estado</th>
    </tr></thead><tbody>${records.map(record => `<tr>
      <td>${esc(record.nombre)}</td><td>${esc(record.sede)}</td>
      <td>${esc(textoTurno(record.turno))}</td><td>${esc(record.horario || "—")}</td>
      <td>${esc(record.hora)}</td><td class="${record.estado === "Tarde" ? "warn" : "ok"}">${esc(record.estado)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

export const pintarHoy = () => { $("#tabla-hoy").innerHTML = tablaRegistros(fechaHoy(), $("#sede").value); };
export const pintarHist = () => { $("#tabla-hist").innerHTML = tablaRegistros($("#fecha-hist").value || fechaHoy()); };

export function pintarPersonal() {
  const people = [...Datos.personal()].sort((a, b) =>
    a.sede.localeCompare(b.sede) || a.nombre.localeCompare(b.nombre));
  $("#tabla-personal").innerHTML = people.length ? `<div class="wrap"><table><thead><tr>
    <th>Nombre</th><th>Sede</th><th>Turno</th><th></th></tr></thead><tbody>
    ${people.map(person => `<tr><td>${esc(person.nombre)}</td><td>${esc(person.sede)}</td>
      <td>${esc(textoTurno(person.turno))}</td><td class="table-actions">
      <button class="btn" data-edit="${esc(person.id)}">Editar</button>
      <button class="btn danger-btn" data-del="${esc(person.id)}">Quitar</button></td></tr>`).join("")}
    </tbody></table></div>` : '<p class="empty">Todavía no hay personal.</p>';
  if ($("#stat-personal")) $("#stat-personal").textContent = people.length;
  if ($("#stat-registros")) $("#stat-registros").textContent =
    Datos.registros().filter(record => record.fecha === fechaHoy()).length;
  if ($("#stat-turnos")) $("#stat-turnos").textContent = Object.keys(appConfig.turnos).length;
}

export function pintarHorarios() {
  const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  $("#tabla-horarios").innerHTML = `<div class="wrap"><table><thead><tr><th>Turno</th>
    ${days.map(day => `<th>${day}</th>`).join("")}<th>Total h</th></tr></thead><tbody>
    ${Object.entries(appConfig.turnos).map(([key, turn]) => `<tr><td>${esc(turn.nombre)}</td>
      ${turn.horario.map(schedule => `<td>${esc(schedule)}</td>`).join("")}<td><strong>${esc(turn.totalHoras || "—")}</strong></td></tr>`).join("")}
    </tbody></table></div>`;
}
