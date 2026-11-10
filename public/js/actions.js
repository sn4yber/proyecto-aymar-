import { REFRESCO_MS } from "./config.js";
import { Datos } from "./data.js";
import { $, descargar, esc, fechaHoy, horaDe } from "./utils.js";
import {
  actualizarBoton, actualizarPersonas, pintarHist, pintarHorarios, pintarHoy,
  pintarPersonal, personaElegida
} from "./views.js";

let personaEditando = null;

export function mostrarMensaje(text, success) {
  $("#mensaje").className = `msg ${success ? "ok" : "bad"}`;
  $("#mensaje").textContent = text;
}

export async function registrar() {
  const person = personaElegida();
  if (!person) return;
  const now = new Date();
  $("#btn-registrar").disabled = true;
  try {
    await Datos.guardarRegistro({
      fecha: fechaHoy(), personalId: person.id, hora: horaDe(now)
    });
    mostrarMensaje(`✓ Inicio registrado a las ${horaDe(now)}`, true);
  } catch (error) {
    mostrarMensaje(error.message, false);
  }
  actualizarBoton();
  pintarHoy();
}

export async function entrarAdmin() {
  const valid = await Datos.login($("#usuario").value.trim(), $("#clave").value);
  if (!valid) {
    $("#login-msg").textContent = "Usuario o contraseña incorrectos.";
    return;
  }
  $("#login").classList.add("hide");
  $("#panel").classList.remove("hide");
  pintarPersonal();
  pintarHorarios();
  pintarHist();
}

export async function agregarPersona() {
  const nombre = $("#nombre").value.trim();
  const sede = $("#sede-nueva").value;
  const turno = $("#turno-nuevo").value;
  if (!nombre || !sede || !turno) {
    $("#nombre").focus();
    return;
  }
  try {
    const persona = { nombre, sede, turno };
    if (personaEditando) {
      await Datos.actualizarPersona(personaEditando, persona);
    } else {
      await Datos.agregarPersona(persona);
    }
    limpiarFormularioPersona();
    pintarPersonal();
    actualizarPersonas();
  } catch (error) {
    window.alert(error.message);
  }
}

function limpiarFormularioPersona() {
  personaEditando = null;
  $("#nombre").value = "";
  $("#btn-agregar").textContent = "Agregar persona";
  $("#btn-cancelar").classList.add("hide");
}

function editarPersona(id) {
  const persona = Datos.personal().find(item => item.id === id);
  if (!persona) return;
  personaEditando = id;
  $("#nombre").value = persona.nombre;
  $("#sede-nueva").value = persona.sede;
  $("#turno-nuevo").value = persona.turno;
  $("#btn-agregar").textContent = "Guardar cambios";
  $("#btn-cancelar").classList.remove("hide");
  $("#nombre").focus();
}

export async function quitarPersona(id) {
  try {
    await Datos.quitarPersona(id);
    pintarPersonal();
    actualizarPersonas();
  } catch (error) {
    window.alert(error.message);
  }
}

export function exportarCSV() {
  const date = $("#fecha-hist").value || fechaHoy();
  const records = Datos.registros().filter(record => record.fecha === date);
  const csv = ["Fecha,Nombre,Sede,Turno,Horario,Hora,Estado",
    ...records.map(record => [record.fecha, record.nombre, record.sede, record.turno,
      record.horario, record.hora, record.estado].map(value => `"${value}"`).join(","))
  ].join("\n");
  descargar(`registros_${date}.csv`, csv, "text/csv");
}

export function configurarEventosRegistro() {
  $("#sede").addEventListener("change", () => {
    $("#mensaje").textContent = "";
    actualizarPersonas();
    actualizarBoton();
    pintarHoy();
  });
  $("#persona").addEventListener("change", () => {
    $("#mensaje").textContent = "";
    actualizarBoton();
  });
  $("#btn-registrar").addEventListener("click", registrar);
}

export function configurarEventosAdmin() {
  $("#btn-login").addEventListener("click", entrarAdmin);
  $("#btn-agregar").addEventListener("click", agregarPersona);
  $("#btn-cancelar").addEventListener("click", limpiarFormularioPersona);
  $("#btn-exportar").addEventListener("click", exportarCSV);
  $("#fecha-hist").addEventListener("change", pintarHist);
  $("#tabla-personal").addEventListener("click", event => {
    const id = event.target.dataset.del;
    const editId = event.target.dataset.edit;
    if (editId) {
      editarPersona(editId);
      return;
    }
    if (id && window.confirm("¿Quitar a esta persona?")) quitarPersona(id);
  });
}

export function iniciarReloj() {
  const tick = () => { $("#reloj").textContent = horaDe(new Date()); };
  tick();
  window.setInterval(tick, 15000);
}

export function iniciarRefresco(admin = false) {
  window.setInterval(async () => {
    try {
      await Datos.cargar();
      if (!admin) {
        actualizarPersonas();
        actualizarBoton();
        pintarHoy();
      }
      if (admin && !$("#panel").classList.contains("hide")) {
        pintarPersonal();
        pintarHorarios();
        pintarHist();
      }
    } catch {
      // La siguiente actualización reintentará la conexión.
    }
  }, REFRESCO_MS);
}
