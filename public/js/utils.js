export const $ = selector => document.querySelector(selector);
export const pad = value => String(value).padStart(2, "0");

export function fechaHoy() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const horaDe = date => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const esc = value => String(value ?? "").replace(/[&<>"]/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
}[character]));
export const diaActual = () => (new Date().getDay() + 6) % 7;

export function descargar(nombre, contenido, tipo) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  link.download = nombre;
  link.click();
  URL.revokeObjectURL(link.href);
}
