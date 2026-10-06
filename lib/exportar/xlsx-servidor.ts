import zlib from "node:zlib";

/**
 * Escritor mínimo de .xlsx para el servidor: una hoja, una imagen opcional en A1 y cinco estilos
 * (los de los Excel de PhpSpreadsheet de los aplicativos antiguos). Escribe el XML fila a fila y
 * lo comprime a medida que avanza, así que un libro de decenas de miles de filas no ocupa más que
 * el archivo final (ExcelJS en memoria pedía ~2 GB para 15.000 filas × 130 columnas). Solo
 * runtime Node.
 *
 * Uso: anchos de columna → filas en orden creciente → generar().
 */

/** Estilos de celda: normal, negrita, encabezado (negrita, gris, borde), borde y borde con #,##0. */
export type EstiloXlsx = "normal" | "negrita" | "encabezado" | "borde" | "borde_miles";

const INDICE_ESTILO: Record<EstiloXlsx, number> = { normal: 0, negrita: 1, encabezado: 2, borde: 3, borde_miles: 4 };

export interface CeldaXlsx {
  /** Columna, desde 1 (A). */
  col: number;
  valor: string | number | null;
  estilo?: EstiloXlsx;
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const NS_R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CABECERA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
/** Tamaño de los trozos de XML que se van comprimiendo. */
const TROZO = 256 * 1024;

export function letraColumna(col: number) {
  let s = "";
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function escapar(texto: string) {
  return texto
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function xmlCelda(ref: string, valor: string | number | null, s: number) {
  const estilo = s ? ` s="${s}"` : "";
  if (valor === null || valor === "") return `<c r="${ref}"${estilo}/>`;
  if (typeof valor === "number") return Number.isFinite(valor) ? `<c r="${ref}"${estilo}><v>${valor === 0 ? 0 : valor}</v></c>` : `<c r="${ref}"${estilo}/>`;
  return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
}

// ---------------------------------------------------------------- ZIP (sin ZIP64: < 4 GB)

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** zlib.crc32 existe desde Node 20.15; si no, la tabla. */
function crc32(buf: Buffer, previo = 0): number {
  const nativo = (zlib as unknown as { crc32?: (d: Buffer, v?: number) => number }).crc32;
  if (nativo) return nativo(buf, previo);
  let c = previo ^ 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entrada {
  nombre: string;
  crc: number;
  comprimido: Buffer;
  tamano: number;
}

/** Archivo comprimido de a trozos (el XML de la hoja), con su CRC. */
class EntradaEnCurso {
  private crc = 0;
  private tamano = 0;
  private salida: Buffer[] = [];
  private deflate = zlib.createDeflateRaw({ level: 6 });
  private fin: Promise<void>;

  constructor(private nombre: string) {
    this.deflate.on("data", (d: Buffer) => this.salida.push(d));
    this.fin = new Promise((ok, mal) => {
      this.deflate.on("end", ok);
      this.deflate.on("error", mal);
    });
  }

  async escribir(texto: string) {
    const buf = Buffer.from(texto, "utf8");
    this.crc = crc32(buf, this.crc);
    this.tamano += buf.length;
    if (!this.deflate.write(buf)) await new Promise((ok) => this.deflate.once("drain", ok));
  }

  async cerrar(): Promise<Entrada> {
    this.deflate.end();
    await this.fin;
    return { nombre: this.nombre, crc: this.crc, tamano: this.tamano, comprimido: Buffer.concat(this.salida) };
  }
}

function entradaFija(nombre: string, contenido: string | Buffer): Entrada {
  const buf = typeof contenido === "string" ? Buffer.from(contenido, "utf8") : contenido;
  return { nombre, crc: crc32(buf), tamano: buf.length, comprimido: zlib.deflateRawSync(buf, { level: 6 }) };
}

function fechaDos(d: Date) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, fecha };
}

function empaquetar(entradas: Entrada[]): Buffer {
  const { hora, fecha } = fechaDos(new Date());
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let desplazamiento = 0;
  for (const e of entradas) {
    const nombre = Buffer.from(e.nombre, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(fecha, 12);
    local.writeUInt32LE(e.crc, 14);
    local.writeUInt32LE(e.comprimido.length, 18);
    local.writeUInt32LE(e.tamano, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    partes.push(local, nombre, e.comprimido);

    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(hora, 12);
    c.writeUInt16LE(fecha, 14);
    c.writeUInt32LE(e.crc, 16);
    c.writeUInt32LE(e.comprimido.length, 20);
    c.writeUInt32LE(e.tamano, 24);
    c.writeUInt16LE(nombre.length, 28);
    c.writeUInt32LE(desplazamiento, 42);
    central.push(c, nombre);
    desplazamiento += local.length + nombre.length + e.comprimido.length;
  }
  const tamanoCentral = central.reduce((n, b) => n + b.length, 0);
  const finCentral = Buffer.alloc(22);
  finCentral.writeUInt32LE(0x06054b50, 0);
  finCentral.writeUInt16LE(entradas.length, 8);
  finCentral.writeUInt16LE(entradas.length, 10);
  finCentral.writeUInt32LE(tamanoCentral, 12);
  finCentral.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...partes, ...central, finCentral]);
}

// ---------------------------------------------------------------- partes del .xlsx

const ESTILOS = `${CABECERA}<styleSheet ${NS}>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFA0A0A0"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function tiposContenido(conImagen: boolean) {
  return `${CABECERA}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>${conImagen ? '\n<Default Extension="png" ContentType="image/png"/>' : ""}
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${
    conImagen ? '\n<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ""
  }
</Types>`;
}

function relaciones(rels: { id: string; tipo: string; destino: string }[]) {
  return `${CABECERA}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels
    .map((r) => `<Relationship Id="${r.id}" Type="${REL}/${r.tipo}" Target="${r.destino}"/>`)
    .join("")}</Relationships>`;
}

/** Imagen anclada en A1 con su tamaño en píxeles (1 px = 9.525 EMU). */
function dibujo(anchoPx: number, altoPx: number) {
  const cx = Math.round(anchoPx * 9525);
  const cy = Math.round(altoPx * 9525);
  return `${CABECERA}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip ${NS_R} r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
}

export class HojaXlsx {
  private imagenPng: { png: Buffer; anchoPx: number; altoPx: number } | null = null;
  private anchos = new Map<number, number>();
  private hoja: EntradaEnCurso | null = null;
  private pendiente: string[] = [];
  private largoPendiente = 0;
  private ultimaFila = 0;

  constructor(private nombre: string) {}

  /** Imagen PNG anclada en A1. */
  imagen(png: Buffer, anchoPx: number, altoPx: number) {
    this.imagenPng = { png, anchoPx, altoPx };
  }

  /** Ancho de una columna (en caracteres, como en Excel). Antes de la primera fila. */
  anchoColumna(col: number, ancho: number) {
    if (this.hoja) throw new Error("Los anchos de columna van antes de las filas.");
    this.anchos.set(col, ancho);
  }

  /** Agrega una fila (número desde 1, en orden creciente). */
  async fila(numero: number, celdas: CeldaXlsx[]) {
    if (numero <= this.ultimaFila) throw new Error("Las filas van en orden creciente.");
    this.ultimaFila = numero;
    if (!this.hoja) await this.abrir();
    const xml = celdas
      .slice()
      .sort((a, b) => a.col - b.col)
      .map((c) => xmlCelda(`${letraColumna(c.col)}${numero}`, c.valor, INDICE_ESTILO[c.estilo ?? "normal"]))
      .join("");
    await this.agregar(`<row r="${numero}">${xml}</row>`);
  }

  private async abrir() {
    this.hoja = new EntradaEnCurso("xl/worksheets/sheet1.xml");
    const cols = [...this.anchos.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([c, a]) => `<col min="${c}" max="${c}" width="${a}" customWidth="1"/>`)
      .join("");
    await this.agregar(`${CABECERA}<worksheet ${NS} ${NS_R}>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>`);
  }

  private async agregar(xml: string) {
    this.pendiente.push(xml);
    this.largoPendiente += xml.length;
    if (this.largoPendiente >= TROZO) await this.vaciar();
  }

  private async vaciar() {
    if (!this.pendiente.length || !this.hoja) return;
    const texto = this.pendiente.join("");
    this.pendiente = [];
    this.largoPendiente = 0;
    await this.hoja.escribir(texto);
  }

  async generar(): Promise<Buffer> {
    if (!this.hoja) await this.abrir();
    await this.agregar(
      `</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>${this.imagenPng ? '<drawing r:id="rId1"/>' : ""}</worksheet>`,
    );
    await this.vaciar();
    const hoja = await this.hoja!.cerrar();
    const img = this.imagenPng;
    const entradas: Entrada[] = [
      entradaFija("[Content_Types].xml", tiposContenido(Boolean(img))),
      entradaFija("_rels/.rels", relaciones([{ id: "rId1", tipo: "officeDocument", destino: "xl/workbook.xml" }])),
      entradaFija("xl/workbook.xml", `${CABECERA}<workbook ${NS} ${NS_R}><sheets><sheet name="${escapar(this.nombre)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      entradaFija(
        "xl/_rels/workbook.xml.rels",
        relaciones([
          { id: "rId1", tipo: "worksheet", destino: "worksheets/sheet1.xml" },
          { id: "rId2", tipo: "styles", destino: "styles.xml" },
        ]),
      ),
      entradaFija("xl/styles.xml", ESTILOS),
      hoja,
    ];
    if (img) {
      entradas.push(
        entradaFija("xl/worksheets/_rels/sheet1.xml.rels", relaciones([{ id: "rId1", tipo: "drawing", destino: "../drawings/drawing1.xml" }])),
        entradaFija("xl/drawings/drawing1.xml", dibujo(img.anchoPx, img.altoPx)),
        entradaFija("xl/drawings/_rels/drawing1.xml.rels", relaciones([{ id: "rId1", tipo: "image", destino: "../media/image1.png" }])),
        entradaFija("xl/media/image1.png", img.png),
      );
    }
    return empaquetar(entradas);
  }
}
