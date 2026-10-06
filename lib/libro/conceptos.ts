// Columnas del Libro de Remuneraciones, en el orden de export_excel_libro.php (aplicativo antiguo
// libro_rem_g2). Compartido entre servidor y cliente (sin dependencias de Node).

/**
 * Cómo se calcula cada concepto en la consulta (class_libro_rem.php):
 * - importe: suma de los importes de esos CC de nómina.
 * - cantidad: suma de las cantidades (días de ausencia o de licencia).
 * - horas: el mayor texto de la cantidad (horas extra); el original usaba max() sobre el texto.
 * - costo_empresa: costo empresa del mes y CC (tabla cc_nomina) más las vacaciones proporcionales.
 * - imponible: imponible del mes con tope de 81,6 UF.
 */
export type TipoConcepto = "importe" | "cantidad" | "horas" | "costo_empresa" | "imponible";

export interface Concepto {
  clave: string;
  titulo: string;
  tipo: TipoConcepto;
  codigos?: string[];
}

/** Columnas fijas del inicio (SOCIEDAD … DIAS). */
export const COLUMNAS_INICIO = [
  { clave: "sociedad", titulo: "SOCIEDAD" },
  { clave: "cc", titulo: "CENTRO COSTO" },
  { clave: "nombre_completo", titulo: "NOMBRE COMPLETO" },
  { clave: "rut", titulo: "RUT" },
  { clave: "np", titulo: "NP" },
  { clave: "cargo", titulo: "CARGO" },
  { clave: "tipo_contrato", titulo: "TIPO CONTRATO" },
  { clave: "fecha_ingreso", titulo: "FECHA INGRESO" },
  { clave: "fecha_retiro", titulo: "FECHA RETIRO" },
  { clave: "dias", titulo: "DIAS" },
] as const;

/** Columnas fijas del final. */
export const COLUMNAS_FIN = [
  { clave: "ames", titulo: "AMES" },
  { clave: "administrativo", titulo: "ADMINISTRATIVO" },
] as const;

/** Conceptos posibles: en el Excel solo aparecen los que tienen algún valor distinto de cero. */
export const CONCEPTOS: Concepto[] = [
  { clave: "costo_empresa", titulo: "COSTO EMPRESA", tipo: "costo_empresa" },
  { clave: "sueldo_base", titulo: "SUELDO BASE", tipo: "importe", codigos: ["M020"] },
  { clave: "gratificacion", titulo: "GRATIFICACION", tipo: "importe", codigos: ["MI11"] },
  { clave: "colacion", titulo: "COLACION", tipo: "importe", codigos: ["1018"] },
  { clave: "movilizacion", titulo: "MOVILIZACION", tipo: "importe", codigos: ["1029"] },
  { clave: "bono_uno", titulo: "BONO UNO", tipo: "importe", codigos: ["1060"] },
  { clave: "aguinaldo", titulo: "AGUINALDO", tipo: "importe", codigos: ["1003"] },
  { clave: "bono", titulo: "BONO", tipo: "importe", codigos: ["1008"] },
  { clave: "bono_anual", titulo: "BONO ANUAL", tipo: "importe", codigos: ["1009"] },
  { clave: "bono_produccion", titulo: "BONO PRODUCCION", tipo: "importe", codigos: ["1014"] },
  { clave: "bono_responsabilidad", titulo: "BONO RESPONSABILIDAD", tipo: "importe", codigos: ["1016", "1011"] },
  { clave: "bono_zona", titulo: "BONO ZONA", tipo: "importe", codigos: ["1035"] },
  { clave: "bono_sala_cuna", titulo: "BONO SAL_CUNA", tipo: "importe", codigos: ["1017"] },
  { clave: "comision_ventas", titulo: "COMISION VENTAS", tipo: "importe", codigos: ["1036"] },
  { clave: "semana_corrida", titulo: "SEMANA CORRIDA", tipo: "importe", codigos: ["1042"] },
  { clave: "cantidad_horas_extra", titulo: "CANTIDAD HORAS EXTRA", tipo: "horas", codigos: ["MI52"] },
  { clave: "horas_extra_50_prociento", titulo: "HORAS EXTRA 50 PORCIENTO", tipo: "importe", codigos: ["MI52"] },
  { clave: "asignacion_traslacion", titulo: "ASIGNACION TRASLACION", tipo: "importe", codigos: ["1034"] },
  { clave: "viatico", titulo: "VIATICO", tipo: "importe", codigos: ["1032"] },
  { clave: "viatico_anticipado", titulo: "VIATICO ANTICIPADO", tipo: "importe", codigos: ["1033"] },
  { clave: "adicional_colacion", titulo: "ADICIONAL COLACION", tipo: "importe", codigos: ["1001"] },
  { clave: "adicional_movilizacion", titulo: "ADICIONAL MOVILIZACION", tipo: "importe", codigos: ["1002"] },
  { clave: "ajuste_liquidacion_n_imp", titulo: "AJUSTE LIQUIDACION N IMPUESTO", tipo: "importe", codigos: ["1004"] },
  { clave: "asignacion_telefono", titulo: "ASIGNACION TELEFONO", tipo: "importe", codigos: ["1007"] },
  { clave: "vacaciones_proporcionales", titulo: "VACACIONES PROPORCIONALES", tipo: "importe", codigos: ["/IF2"] },
  { clave: "prov_vac", titulo: "PROVISION DE VACACIONES", tipo: "importe", codigos: ["8P03"] },
  { clave: "mes_aviso", titulo: "MES DE AVISO", tipo: "importe", codigos: ["/IF3"] },
  { clave: "indemnizacion_legal", titulo: "INDEMNIZACION LEGAL", tipo: "importe", codigos: ["1028", "/IF1"] },
  { clave: "indemnizacion_tiempo_servicio", titulo: "INDEMNIZACION TIEMPO DE SERVICIO", tipo: "importe", codigos: ["/IF5"] },
  { clave: "indemnizacion_voluntaria", titulo: "INDEMNIZACION VOLUNTARIA", tipo: "importe", codigos: ["/IF4"] },
  { clave: "sobregiro", titulo: "SOBREGIRO", tipo: "importe", codigos: ["/561"] },
  { clave: "asignacio_familiar", titulo: "ASIGNACION FAMILIAR", tipo: "importe", codigos: ["1040", "/I13", "/I11", "/I12"] },
  { clave: "cotizacion_afp", titulo: "COTIZACION AFP", tipo: "importe", codigos: ["MDR1", "MDR3", "MD01", "MD03", "MD61"] },
  { clave: "ahorro_voluntario", titulo: "AHORRO VOLUNTARIO", tipo: "importe", codigos: ["MD04"] },
  { clave: "apv_reg_a", titulo: "APV REG A", tipo: "importe", codigos: ["MD11"] },
  { clave: "apv_reg_b", titulo: "APV REG B", tipo: "importe", codigos: ["MD10"] },
  { clave: "cotizacion_adiciona_salud", titulo: "COTIZACION ADICIONAL SALUD", tipo: "importe", codigos: ["/302", "/303"] },
  { clave: "cotizacion_salud", titulo: "COTIZACION SALUD", tipo: "importe", codigos: ["MDRD", "MDRE", "MDR7", "/300", "7042", "/T13", "/T14"] },
  { clave: "seguro_cesantia", titulo: "SEGURO CESANTIA", tipo: "importe", codigos: ["MDR9", "MD09"] },
  { clave: "impuesto_renta", titulo: "IMPUESTO A LA RENTA", tipo: "importe", codigos: ["MDRI", "/312"] },
  { clave: "anticipo", titulo: "ANTICIPO", tipo: "importe", codigos: ["7000"] },
  { clave: "anticipo_aguinaldo", titulo: "ANTICIPO AGUINALDO", tipo: "importe", codigos: ["7001"] },
  { clave: "retencion_judicial", titulo: "RETENCION JUDICIAL", tipo: "importe", codigos: ["/GMT"] },
  { clave: "convenio_falp", titulo: "CONVENIO FALP", tipo: "importe", codigos: ["7005"] },
  { clave: "full_ahorro_caja", titulo: "FULL AHORRO CAJA", tipo: "importe", codigos: ["7024"] },
  { clave: "pmo_solidario_ley_21252", titulo: "PMO SOLIDARIO LEY 21.252", tipo: "importe", codigos: ["7047"] },
  { clave: "seguro_dental", titulo: "SEGURO DENTAL", tipo: "importe", codigos: ["7037"] },
  { clave: "seguro_salud", titulo: "SEGURO SALUD", tipo: "importe", codigos: ["7038"] },
  { clave: "seguro_ccaf", titulo: "SEGURO CCAF", tipo: "importe", codigos: ["7039"] },
  { clave: "seguro_chilena_consolidada", titulo: "SEGURO CHILENA CONSOLIDADA", tipo: "importe", codigos: ["7040"] },
  { clave: "seguro_vida_camara", titulo: "SEGURO DE SALUD", tipo: "importe", codigos: ["7041"] },
  { clave: "costo_seguro_com", titulo: "COSTO SEGURO COMPLEMENTARIO", tipo: "importe", codigos: ["9I18"] },
  { clave: "sobregiro_mes_anterior", titulo: "SOBREGIRO MES ANTERIOR", tipo: "importe", codigos: ["/563"] },
  { clave: "descuento_alojamiento", titulo: "DESCUENTO ALOJAMIENTO", tipo: "importe", codigos: ["7007"] },
  { clave: "descuento_fxr", titulo: "DESCUENTO FxR", tipo: "importe", codigos: ["7015"] },
  { clave: "dcto_bienestar", titulo: "DESCUENTO BROLLY", tipo: "importe", codigos: ["7008"] },
  { clave: "descuento_por_ajuste", titulo: "DESCUENTO POR AJUSTE", tipo: "importe", codigos: ["7021"] },
  { clave: "ajuste_finiquito", titulo: "INDEMNNIZACIÓN CTP", tipo: "importe", codigos: ["/IF8"] },
  { clave: "prestamo_ccaf_los_andes", titulo: "PRESTAMO CCAF LOS ANDES", tipo: "importe", codigos: ["7032"] },
  { clave: "descuento_casona", titulo: "DESCUENTO CASONA", tipo: "importe", codigos: ["7010"] },
  { clave: "anticipo_finiquito", titulo: "ANTICIPO FINIQUITO", tipo: "importe", codigos: ["7046"] },
  { clave: "prestamo_empresa", titulo: "PRÉSTAMO EMPRESA", tipo: "importe", codigos: ["1041"] },
  { clave: "descuento_sobregiro", titulo: "DESCUENTO SOBREGIRO", tipo: "importe", codigos: ["7044"] },
  { clave: "desgaste_herramienta", titulo: "DESGASTE HERRAMIENTA", tipo: "importe", codigos: ["1020"] },
  { clave: "ausencia", titulo: "AUSENCIA", tipo: "cantidad", codigos: ["MT30", "MT73", "MT74"] },
  { clave: "licencia_medica", titulo: "LICENCIA MEDICA", tipo: "cantidad", codigos: ["MT70", "MT80"] },
  { clave: "liquido_pago", titulo: "LIQUIDO A PAGO", tipo: "importe", codigos: ["/559"] },
  { clave: "aporte_afc", titulo: "APORTE AFC", tipo: "importe", codigos: ["/ER1", "/ER2", "/E01", "/E02", "/E03"] },
  { clave: "descuento_aporte_afc", titulo: "DESCUENTO APORTE AFC", tipo: "importe", codigos: ["7045"] },
  { clave: "desc_prestamo_empresa", titulo: "DESCUENTO PRESTAMO EMPRESA", tipo: "importe", codigos: ["7043"] },
  { clave: "mutual", titulo: "MUTUAL", tipo: "importe", codigos: ["/ER4", "/ER5", "/E04", "/E05", "/E10"] },
  { clave: "sis", titulo: "SIS", tipo: "importe", codigos: ["MDR2", "MD02", "/E08"] },
  { clave: "imponible", titulo: "IMPONIBLE", tipo: "imponible" },
  { clave: "bono_puntualidad", titulo: "BONO PUNTUALIDAD", tipo: "importe", codigos: ["1015"] },
  { clave: "trato", titulo: "TRATO", tipo: "importe", codigos: ["1031"] },
  { clave: "covid_19", titulo: "SUSP. REM COVID 19", tipo: "importe", codigos: ["1038"] },
  { clave: "diferencia_liquido", titulo: "DIFERENCIA LIQUIDO", tipo: "importe", codigos: ["1026"] },
  { clave: "anticipo_extraordinario", titulo: "ANTICIPO EXTRAORDINARIO", tipo: "importe", codigos: ["7003"] },
  { clave: "convenio_oftalm", titulo: "CONVENIO OFTALM. C.CH.C.", tipo: "importe", codigos: ["7006"] },
  { clave: "feriado_progresivo", titulo: "FERIADO PROGRESIVO", tipo: "importe", codigos: ["1027"] },
  { clave: "operativo_oftalm", titulo: "OPERATIVO OFTALMOLOGICO", tipo: "importe", codigos: ["7018"] },
  { clave: "descuento_equipo", titulo: "DESCUENTO EQUIPO", tipo: "importe", codigos: ["7014"] },
  { clave: "descuento_permiso_sindical", titulo: "DESCUENTO PERMISO SINDICAL", tipo: "importe", codigos: ["7020"] },
  { clave: "prestamo_ccaf_los_heroes", titulo: "PRÉSTAMO CCAF LOS HÉROES", tipo: "importe", codigos: ["7031"] },
  { clave: "bono_seguridad", titulo: "BONO INCENTIVO DE SEGURIDAD", tipo: "importe", codigos: ["1050"] },
  { clave: "bono_produccion_incentivo", titulo: "BONO INCENTIVO DE PRODUCCION", tipo: "importe", codigos: ["1051"] },
  { clave: "diferencia_gratificacion", titulo: "DIFERENCIA GRATIFICACION", tipo: "importe", codigos: ["1024"] },
  { clave: "operativo_dental", titulo: "OPERATIVO DENTAL", tipo: "importe", codigos: ["7019"] },
  { clave: "dcto_ptmo_fonasa", titulo: "DCTO. PTMO FONASA", tipo: "importe", codigos: ["7022"] },
  { clave: "bono_icd", titulo: "BONO ICD", tipo: "importe", codigos: ["1052"] },
  { clave: "bono_sabado", titulo: "BONO SABADO", tipo: "importe", codigos: ["1061"] },
  { clave: "bono_liquido", titulo: "BONO LIQUIDO", tipo: "importe", codigos: ["1066"] },
  { clave: "bono_liquido_2", titulo: "BONO LIQUIDO 2", tipo: "importe", codigos: ["1067"] },
  { clave: "tratero", titulo: "BONO TRATERO", tipo: "importe", codigos: ["1065"] },
  { clave: "descuento_programa_mujer", titulo: "DESCUENTO PROGRAMA MUJER", tipo: "importe", codigos: ["7049"] },
  { clave: "cantidad_horas_rxtras_j_44h_50_prociento", titulo: "CANTIDAD CANTIDAD HORAS EXTRA J44H", tipo: "horas", codigos: ["MI54"] },
  { clave: "horas_rxtras_j_44h_50_prociento", titulo: "HORAS EXTRA 50 PORCIENTO J44H", tipo: "importe", codigos: ["MI54"] },
  { clave: "cantidad_horas_extra_mi55", titulo: "CANTIDAD CANTIDAD HORAS EXTRA FESTIVO", tipo: "horas", codigos: ["MI55"] },
  { clave: "horas_extra_mi55", titulo: "HORAS EXTRA 50 PORCIENTO FESTIVO", tipo: "importe", codigos: ["MI55"] },
  { clave: "cantidad_horas_extra_mi56", titulo: "CANTIDAD CANTIDAD HORAS EXTRA (42hrs)", tipo: "horas", codigos: ["MI56"] },
  { clave: "horas_extra_mi56", titulo: "HORAS EXTRA 50 PORCIENTO (42hrs)", tipo: "importe", codigos: ["MI56"] },
  { clave: "bono_excelencia", titulo: "BONO EXCELENCIA", tipo: "importe", codigos: ["1054"] },
  { clave: "apt_colecta_ayuda", titulo: "APT. COLECTA AYUDA", tipo: "importe", codigos: ["1006"] },
  { clave: "descuento_colecta", titulo: "DESCUENTO COLECTA", tipo: "importe", codigos: ["7012"] },
  { clave: "descuento_vestuario", titulo: "DESCUENTO VESTUARIO", tipo: "importe", codigos: ["7055"] },
  { clave: "bono_permanencia", titulo: "BONO PERMANENCIA", tipo: "importe", codigos: ["1056"] },
  { clave: "bono_incentivo_trimestral", titulo: "BONO INCENTIVO TRIMESTRAL", tipo: "importe", codigos: ["1055"] },
  { clave: "bono_mensual_reliq", titulo: "BONO MENSUAL RELIQ", tipo: "importe", codigos: ["1R48"] },
  { clave: "rem_pago_exceso", titulo: "REM. PAGO EXCESO", tipo: "importe", codigos: ["7035"] },
  { clave: "bono_proyecto", titulo: "BONO PROYECTO", tipo: "importe", codigos: ["1058"] },
  { clave: "nombre_cuota_sindical", titulo: "NOMBRE CUOTA SINDICAL", tipo: "importe", codigos: ["7051"] },
  { clave: "contrib_empreador_pension", titulo: "CONTRIBUCION EMPREADOR PENSIÓN", tipo: "importe", codigos: ["/E12", "/ERT"] },
  { clave: "comp_expectativa_vida", titulo: "COMP. EXPECTATIVA DE VIDA", tipo: "importe", codigos: ["/E13", "/ERV"] },
  { clave: "contrib_ingreso_proteccion", titulo: "CONTRIB INGRESO PROTECC.", tipo: "importe", codigos: ["/E14"] },
];
