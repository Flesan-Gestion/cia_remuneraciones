import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

/**
 * Lo mínimo de FPDF (PHP) sobre pdfkit, para dibujar la liquidación con las mismas
 * coordenadas que liquidaciones_pdf_new.php del aplicativo antiguo: unidades en mm, márgenes
 * de 1 cm, Cell/MultiCell con el mismo corte de líneas y los mismos bordes, y salto de página
 * automático a 2 cm del pie. Solo runtime Node.
 */

/** Puntos por milímetro (FPDF: k = 72/25.4 con unidad «mm»). */
const K = 72 / 25.4;
/** Margen por defecto de FPDF: 28.35 pt. */
const MARGEN = 28.35 / K;

/** En la fuente incrustada (Carlito), sin kerning ni ligaduras, como FPDF. pdfkit tipa
 * `features` como lista de etiquetas, pero fontkit también acepta { etiqueta: false }. */
const SIN_KERNING = { kern: false, liga: false, clig: false, calt: false } as unknown as PDFKit.Mixins.OpenTypeFeatures[];

const CARLITO = path.join(process.cwd(), "lib/liquidaciones/fuentes/Carlito-Regular.ttf");
let carlito: Buffer | null = null;

/** Fuentes que usa la liquidación. «Arial» de FPDF es Helvetica; «Calibri Regular» se reemplaza
 * por Carlito, de métricas idénticas a Calibri y licencia libre (OFL). */
function fuentePdfkit(familia: string, estilo: string) {
  if (familia === "Calibri Regular") return "Calibri Regular";
  return estilo.includes("B") ? "Helvetica-Bold" : "Helvetica";
}

export interface OpcionesFpdf {
  /** Ancho y alto de la página en mm (FPDF: array(215.9, 279.4), carta). */
  formato: [number, number];
  /** Contraseña para abrir el PDF (cifrado AES-256). Sin ella, el PDF va abierto. */
  clave?: string;
}

export class Fpdf {
  private readonly doc: PDFKit.PDFDocument;
  private readonly partes: Buffer[] = [];
  private readonly ancho: number;
  private readonly alto: number;
  private readonly lMargin = MARGEN;
  private readonly tMargin = MARGEN;
  private readonly rMargin = MARGEN;
  private readonly cMargin = MARGEN / 10;
  private readonly pageBreakTrigger: number;
  private x = 0;
  private y = 0;
  private lasth = 0;
  private familia = "Arial";
  private estilo = "";
  private tamanoPt = 12;
  private readonly anchos = new Map<string, number>();

  constructor({ formato, clave }: OpcionesFpdf) {
    [this.ancho, this.alto] = formato;
    this.pageBreakTrigger = this.alto - 2 * MARGEN;
    this.doc = new PDFDocument({
      autoFirstPage: false,
      margin: 0,
      size: [this.ancho * K, this.alto * K],
      info: { Title: "Liquidación de remuneraciones", Producer: "Liquidaciones SAP · Grupo Flesan" },
      ...(clave
        ? {
            pdfVersion: "1.7ext3" as const,
            userPassword: clave,
            // Contraseña de propietario aleatoria: nadie puede quitar la protección.
            ownerPassword: crypto.randomUUID(),
            permissions: { printing: "highResolution" as const, copying: true },
          }
        : {}),
    });
    carlito ??= readFileSync(CARLITO);
    this.doc.registerFont("Calibri Regular", carlito);
    this.doc.on("data", (parte: Buffer) => this.partes.push(parte));
  }

  AddPage() {
    this.doc.addPage({ size: [this.ancho * K, this.alto * K], margin: 0 });
    this.x = this.lMargin;
    this.y = this.tMargin;
    this.lasth = 0;
  }

  SetFont(familia: string, estilo = "", tamanoPt = this.tamanoPt) {
    this.familia = familia;
    this.estilo = estilo;
    this.tamanoPt = tamanoPt;
  }

  GetY() {
    return this.y;
  }

  SetXY(x: number, y: number) {
    this.x = x >= 0 ? x : this.ancho + x;
    this.y = y >= 0 ? y : this.alto + y;
  }

  /** Salto de línea: vuelve al margen izquierdo y baja lo que midió la última celda. */
  Ln(h?: number) {
    this.x = this.lMargin;
    this.y += h ?? this.lasth;
  }

  /** Tamaño de la letra en mm. */
  private get tamano() {
    return this.tamanoPt / K;
  }

  private aplicarFuente() {
    this.doc.font(fuentePdfkit(this.familia, this.estilo)).fontSize(this.tamanoPt);
    // FPDF avanza cada letra con su ancho, sin kerning. pdfkit aplica los pares de kerning de las
    // fuentes estándar sin opción para evitarlo: se vacían en la fuente de este documento.
    const afm = (this.doc as unknown as { _font?: { font?: { kernPairs?: object } } })._font?.font;
    if (afm?.kernPairs) afm.kernPairs = {};
  }

  /** Ancho de un carácter en mm, sin kerning (FPDF suma anchos sueltos). */
  private anchoCaracter(c: string) {
    const clave = `${this.familia}|${this.estilo}|${this.tamanoPt}|${c}`;
    let a = this.anchos.get(clave);
    if (a === undefined) {
      this.aplicarFuente();
      a = this.doc.widthOfString(c) / K;
      this.anchos.set(clave, a);
    }
    return a;
  }

  private anchoTexto(s: string) {
    let a = 0;
    for (const c of s) a += this.anchoCaracter(c);
    return a;
  }

  private linea(x1: number, y1: number, x2: number, y2: number) {
    this.doc
      .moveTo(x1 * K, y1 * K)
      .lineTo(x2 * K, y2 * K)
      .lineWidth(0.567)
      .strokeColor("black")
      .stroke();
  }

  Cell(w: number, h = 0, txt = "", border: number | string = 0, ln = 0, align: string | number = "") {
    if (this.y + h > this.pageBreakTrigger) {
      const x = this.x;
      this.AddPage();
      this.x = x;
    }
    if (w === 0) w = this.ancho - this.rMargin - this.x;
    const { x, y } = this;
    if (border === 1) {
      this.doc.rect(x * K, y * K, w * K, h * K).lineWidth(0.567).strokeColor("black").stroke();
    } else if (typeof border === "string") {
      if (border.includes("L")) this.linea(x, y, x, y + h);
      if (border.includes("T")) this.linea(x, y, x + w, y);
      if (border.includes("R")) this.linea(x + w, y, x + w, y + h);
      if (border.includes("B")) this.linea(x, y + h, x + w, y + h);
    }
    if (txt !== "") {
      // El aplicativo antiguo corre en PHP 7, donde `0 == 'R'` es verdadero: pasar align 0 (como
      // hace liquidaciones_pdf_new.php con los montos y el total) alinea a la derecha.
      const derecha = align === "R" || align === 0;
      const dx = derecha ? w - this.cMargin - this.anchoTexto(txt) : align === "C" ? (w - this.anchoTexto(txt)) / 2 : this.cMargin;
      this.aplicarFuente();
      this.doc.fillColor("black").text(txt, (x + dx) * K, (y + 0.5 * h + 0.3 * this.tamano) * K, {
        lineBreak: false,
        baseline: "alphabetic",
        features: SIN_KERNING,
      });
    }
    this.lasth = h;
    if (ln > 0) {
      this.y += h;
      if (ln === 1) this.x = this.lMargin;
    } else {
      this.x += w;
    }
  }

  /** MultiCell de FPDF 1.8: corta en «\n» y por palabras al pasar el ancho; con border=1 el
   * bloque queda dentro de un solo rectángulo. Al terminar, x vuelve al margen izquierdo. No
   * justifica («J», o align 0 en PHP 7): en la liquidación, las celdas con align 0 solo traen
   * espacios al inicio, así que una línea justificada sería una línea en blanco igual. */
  MultiCell(w: number, h: number, txt: string, border: number | string = 0, align: string | number = "J") {
    if (w === 0) w = this.ancho - this.rMargin - this.x;
    const wmax = w - 2 * this.cMargin;
    const s = txt.replace(/\r/g, "");
    let nb = s.length;
    if (nb > 0 && s[nb - 1] === "\n") nb--;
    let b: string | number = 0;
    let b2 = "";
    if (border) {
      if (border === 1) {
        border = "LTRB";
        b = "LRT";
        b2 = "LR";
      } else {
        b2 = "";
        if (String(border).includes("L")) b2 += "L";
        if (String(border).includes("R")) b2 += "R";
        b = String(border).includes("T") ? b2 + "T" : b2;
      }
    }
    let sep = -1;
    let i = 0;
    let j = 0;
    let l = 0;
    let nl = 1;
    while (i < nb) {
      const c = s[i];
      if (c === "\n") {
        this.Cell(w, h, s.slice(j, i), b, 2, align);
        i++;
        sep = -1;
        j = i;
        l = 0;
        nl++;
        if (border && nl === 2) b = b2;
        continue;
      }
      if (c === " ") sep = i;
      l += this.anchoCaracter(c);
      if (l > wmax) {
        if (sep === -1) {
          if (i === j) i++;
          this.Cell(w, h, s.slice(j, i), b, 2, align);
        } else {
          this.Cell(w, h, s.slice(j, sep), b, 2, align);
          i = sep + 1;
        }
        sep = -1;
        j = i;
        l = 0;
        nl++;
        if (border && nl === 2) b = b2;
      } else {
        i++;
      }
    }
    if (border && String(border).includes("B")) b = `${b}B`;
    this.Cell(w, h, s.slice(j, i), b, 2, align);
    this.x = this.lMargin;
  }

  /** Cierra el documento y entrega el PDF. */
  async Output(): Promise<Buffer> {
    const fin = new Promise<void>((resolver, rechazar) => {
      this.doc.on("end", resolver);
      this.doc.on("error", rechazar);
    });
    this.doc.end();
    await fin;
    return Buffer.concat(this.partes);
  }
}

/** Como utf8_decode de PHP: lo que no cabe en Latin-1 queda como «?». */
export function latin1(texto: string | null | undefined): string {
  return String(texto ?? "").replace(/[^\u0000-ÿ]/g, "?");
}
