import type { PasoTutorial } from "./tutorial";

// SHELL · recorrido general de la plataforma: lo que es igual en todas (menú, barra superior,
// buzón, configuración). Es el que muestra el birrete en las pantallas sin recorrido propio y el
// que se ofrece la primera vez en Inicio. Los pasos cuya zona no está (ej. una plataforma sin
// estado de datos o sin campanita) se saltan solos.
export const PASOS_PLATAFORMA: PasoTutorial[] = [
  {
    selector: 'nav[aria-label="Principal"]',
    titulo: "El menú",
    texto: "Aquí están las secciones de la plataforma. Las que tienen una flecha abren un menú con sus vistas al pasar el mouse.",
  },
  {
    selector: 'nav[aria-label="Ruta"]',
    titulo: "Dónde estás",
    texto: "La ruta muestra la sección y la vista en que estás. Haz clic en un tramo para volver a él.",
  },
  {
    selector: '[data-tutorial="estado-datos"]',
    titulo: "Qué tan al día están los datos",
    texto: "En verde, los datos están al día; en ámbar o rojo, la última carga está atrasada. Pasa el mouse para ver la fecha exacta, o actualiza con la flecha.",
  },
  {
    selector: '[data-tutorial="campanita"]',
    titulo: "Tus notificaciones",
    texto: "La campanita avisa lo que te toca: entregas, rechazos, recordatorios y comentarios. El número rojo son las que no has leído.",
  },
  {
    selector: '[data-tutorial="buzon"]',
    titulo: "Escríbele al equipo CIA",
    texto: "¿Algo no funciona o se te ocurre una mejora? Escríbenos desde aquí: te respondemos en el mismo buzón.",
  },
  {
    selector: '[data-tutorial="pantalla-completa"]',
    titulo: "Más espacio para leer",
    texto: "Pantalla completa esconde el menú para presentar un reporte. Al lado, cambias entre tema claro y oscuro.",
  },
  {
    selector: '[data-tutorial="configuracion"]',
    titulo: "Configuración",
    texto: "En Mi personalización ajustas el tamaño, la densidad, tu página de inicio y estos tutoriales.",
  },
  {
    selector: '[data-boton-tutorial]',
    titulo: "Vuelve cuando quieras",
    texto: "El birrete repite este recorrido. En las pantallas que lo tienen, explica primero esa pantalla.",
  },
];
