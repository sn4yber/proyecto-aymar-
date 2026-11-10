import { appConfig } from "./config.js";

export const Datos = {
  personalData: [],
  registrosData: [],
  usuario: "",
  clave: "",

  async api(route, options = {}) {
    const response = await fetch(route, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-usuario": this.usuario,
        "x-clave": this.clave,
        ...options.headers
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Error de conexión");
    return data;
  },

  async cargar() {
    const [config, personal, registros] = await Promise.all([
      this.api("/api/config"),
      this.api("/api/personal"),
      this.api("/api/registros")
    ]);
    appConfig.sedes = config.sedes;
    appConfig.turnos = config.turnos;
    this.personalData = personal;
    this.registrosData = registros;
  },

  personal() { return this.personalData; },
  registros() { return this.registrosData; },

  async login(usuario, clave) {
    this.usuario = usuario;
    this.clave = clave;
    try {
      await this.api("/api/login", { method: "POST" });
      return true;
    } catch {
      this.usuario = "";
      this.clave = "";
      return false;
    }
  },

  async agregarPersona(persona) {
    await this.api("/api/personal", { method: "POST", body: JSON.stringify(persona) });
    await this.cargar();
  },

  async quitarPersona(id) {
    await this.api(`/api/personal/${encodeURIComponent(id)}`, { method: "DELETE" });
    await this.cargar();
  },

  async actualizarPersona(id, persona) {
    await this.api(`/api/personal/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(persona)
    });
    await this.cargar();
  },

  async guardarRegistro(registro) {
    await this.api("/api/registros", { method: "POST", body: JSON.stringify(registro) });
    await this.cargar();
  }
};
