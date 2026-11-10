import { Datos } from "./data.js";
import { $ , fechaHoy } from "./utils.js";
import { configurarEventosAdmin, configurarEventosRegistro, iniciarRefresco, iniciarReloj, mostrarMensaje } from "./actions.js";
import { actualizarBoton, actualizarPersonas, llenarSelects, pintarHoy } from "./views.js";

async function iniciar() {
  const admin = document.body.dataset.page === "admin";
  if (admin) {
    configurarEventosAdmin();
    $("#fecha-hist").value = fechaHoy();
  } else {
    configurarEventosRegistro();
    iniciarReloj();
  }
  try {
    await Datos.cargar();
    llenarSelects();
    if (admin) {
    } else {
      actualizarPersonas();
      actualizarBoton();
      pintarHoy();
    }
  } catch {
    if (admin) {
      $("#login-msg").textContent = "No hay conexión con el servidor.";
    } else {
      mostrarMensaje("No hay conexión con el servidor.", false);
    }
  }
  iniciarRefresco(admin);
}

iniciar();
