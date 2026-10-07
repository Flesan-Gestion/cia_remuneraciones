// Columnas del Excel de finiquitos, en el orden de export_excel_finiquito.php (aplicativo antiguo
// finiquito_rem). Compartido entre servidor y cliente (sin dependencias de Node).

/**
 * Cómo se calcula cada concepto en la consulta (class_finiquito_rem.php):
 * - importe: suma de los importes de esos CC de nómina.
 * - horas: el mayor texto de la cantidad (horas extra); el original usaba max() sobre el texto.
 * - costo_empresa: costo empresa del mes y CC de la persona (tabla cc_nomina).
 * - imponible: imponible del mes con tope de 81,6 UF, por los días del finiquito / 30.
 */
export type TipoConceptoFiniquito = "importe" | "horas" | "costo_empresa" | "imponible";

export interface ConceptoFiniquito {
  clave: string;
  titulo: string;
  tipo: TipoConceptoFiniquito;
  codigos?: string[];
}

/** Columnas fijas del inicio de la hoja «Finiquito_rem»: solo van las que tienen algún dato. */
export const COLUMNAS_INICIO = [
  { clave: "sociedad", titulo: "SOCIEDAD" },
  { clave: "cc", titulo: "CENTRO COSTO" },
  { clave: "nombre_completo", titulo: "NOMBRE COMPLETO" },
  { clave: "rut", titulo: "RUT" },
  { clave: "np", titulo: "NP" },
  { clave: "cargo", titulo: "CARGO" },
  { clave: "tipo_contrato", titulo: "TIPO CONTRATO" },
  { clave: "fecha_ingreso", titulo: "FECHA INGRESO" },
  { clave: "fecha_estimada_termino", titulo: "FECHA ESTIMADA TERMINO" },
  { clave: "fecha_retiro", titulo: "FECHA RETIRO" },
  { clave: "dias", titulo: "DIAS" },
  { clave: "dias_vacaciones", titulo: "DIAS VACACIONES" },
  { clave: "causal_termino", titulo: "CAUSAL TERMINO" },
] as const;

/** Columnas fijas del final (van siempre). */
export const COLUMNAS_FIN = [
  { clave: "ames", titulo: "AMES" },
  { clave: "semana", titulo: "SEMANA" },
] as const;

/**
 * Conceptos posibles, con los títulos del original: en el Excel solo aparecen los que tienen algún
 * valor distinto de cero. El original también listaba COSTO EMPRESA EAT, pero su consulta no lo
 * traía y nunca salía; y su consulta calculaba otras 35 columnas que el Excel nunca mostraba: aquí no
 * se piden.
 */
export const CONCEPTOS: ConceptoFiniquito[] = [
  { clave: "costo_empresa", titulo: "COSTO EMPRESA", tipo: "costo_empresa" },
  { clave: "sueldo_base", titulo: "SUELDO BASE", tipo: "importe", codigos: ["M020"] },
  { clave: "gratificacion", titulo: "GRATIFICACION", tipo: "importe", codigos: ["MI11"] },
  { clave: "colacion", titulo: "COLACION", tipo: "importe", codigos: ["1018"] },
  { clave: "movilizacion", titulo: "MOVILIZACION", tipo: "importe", codigos: ["1029"] },
  { clave: "aguinaldo", titulo: "AGUINALDO", tipo: "importe", codigos: ["1003"] },
  { clave: "comision_ventas", titulo: "COMISION VENTAS", tipo: "importe", codigos: ["1036"] },
  { clave: "semana_corrida", titulo: "SEMANA CORRIDA", tipo: "importe", codigos: ["1042"] },
  { clave: "bono_uno", titulo: "BONO UNO", tipo: "importe", codigos: ["1060"] },
  { clave: "bono", titulo: "BONO", tipo: "importe", codigos: ["1008"] },
  { clave: "bono_anual", titulo: "BONO ANUAL", tipo: "importe", codigos: ["1009"] },
  { clave: "bono_produccion", titulo: "BONO PRODUCCION", tipo: "importe", codigos: ["1014"] },
  { clave: "bono_responsabilidad", titulo: "BONO RESPONSABILIDAD", tipo: "importe", codigos: ["1016", "1011"] },
  { clave: "bono_zona", titulo: "BONO ZONA", tipo: "importe", codigos: ["1035"] },
  { clave: "bono_sala_cuna", titulo: "BONO SALA CUNA", tipo: "importe", codigos: ["1017"] },
  { clave: "bono_puntualidad", titulo: "BONO PUNTUALIDAD", tipo: "importe", codigos: ["1015"] },
  { clave: "bono_seguridad", titulo: "BONO INCENTIVO DE SEGURIDAD", tipo: "importe", codigos: ["1050"] },
  { clave: "bono_produccion_incentivo", titulo: "BONO INCENTIVO DE PRODUCCION", tipo: "importe", codigos: ["1051"] },
  { clave: "bono_icd", titulo: "BONO ICD", tipo: "importe", codigos: ["1052"] },
  { clave: "bono_sabado", titulo: "BONO SABADO", tipo: "importe", codigos: ["1061"] },
  { clave: "bono_liquido", titulo: "BONO LIQUIDO", tipo: "importe", codigos: ["1066"] },
  { clave: "bono_liquido_2", titulo: "BONO LIQUIDO 2", tipo: "importe", codigos: ["1067"] },
  { clave: "bono_excelencia", titulo: "BONO EXCELENCIA", tipo: "importe", codigos: ["1054"] },
  { clave: "bono_permanencia", titulo: "BONO PERMANENCIA", tipo: "importe", codigos: ["1056"] },
  { clave: "bono_incentivo_trimestral", titulo: "BONO INCENTIVO TRIMESTRAL", tipo: "importe", codigos: ["1055"] },
  { clave: "cantidad_horas_extra", titulo: "CANTIDAD HORAS EXTRA", tipo: "horas", codigos: ["MI52"] },
  { clave: "horas_extra_50_prociento", titulo: "HORAS EXTRA 50 PORCIENTO", tipo: "importe", codigos: ["MI52"] },
  { clave: "cantidad_horas_extra__", titulo: "CANTIDAD HORAS EXTRA J44H", tipo: "horas", codigos: ["MI54"] },
  { clave: "horas_extra__", titulo: "HORAS EXTRA J44H", tipo: "importe", codigos: ["MI54"] },
  { clave: "cantidad_horas_extra_2", titulo: "CANTIDAD HORAS EXTRA FESTIVO", tipo: "horas", codigos: ["MI55"] },
  { clave: "horas_extra_2", titulo: "HORAS EXTRA FESTIVO", tipo: "importe", codigos: ["MI55"] },
  { clave: "cantidad_horas_extra_mi56", titulo: "CANTIDAD HORAS EXTRA (42hrs)", tipo: "horas", codigos: ["MI56"] },
  { clave: "horas_extra_mi56", titulo: "HORAS EXTRA (42hrs)", tipo: "importe", codigos: ["MI56"] },
  { clave: "asignacion_traslacion", titulo: "ASIGNACION TRASLACION", tipo: "importe", codigos: ["1034"] },
  { clave: "viatico", titulo: "VIATICO", tipo: "importe", codigos: ["1032"] },
  { clave: "viatico_anticipado", titulo: "VIATICO ANTICIPADO", tipo: "importe", codigos: ["1033"] },
  { clave: "adicional_colacion", titulo: "ADICIONAL COLACION", tipo: "importe", codigos: ["1001"] },
  { clave: "adicional_movilizacion", titulo: "ADICIONAL MOVILIZACION", tipo: "importe", codigos: ["1002"] },
  { clave: "ajuste_liquidacion_n_imp", titulo: "AJUSTE LIQUIDACION N IMPUESTO", tipo: "importe", codigos: ["1004"] },
  { clave: "asignacion_telefono", titulo: "ASIGNACION TELEFONO", tipo: "importe", codigos: ["1007"] },
  { clave: "vacaciones_proporcionales", titulo: "VACACIONES PROPORCIONALES", tipo: "importe", codigos: ["/IF2"] },
  { clave: "mes_aviso", titulo: "MES DE AVISO", tipo: "importe", codigos: ["/IF3"] },
  { clave: "indemnizacion_legal", titulo: "INDEMNIZACION LEGAL", tipo: "importe", codigos: ["1028", "/IF1"] },
  { clave: "indemnizacion_tiempo_servicio", titulo: "INDEMNIZACION TIEMPO DE SERVICIO", tipo: "importe", codigos: ["/IF5"] },
  { clave: "indemnizacion_voluntaria", titulo: "INDEMNIZACION VOLUNTARIA", tipo: "importe", codigos: ["/IF4"] },
  { clave: "sobregiro", titulo: "SOBREGIRO", tipo: "importe", codigos: ["/561"] },
  { clave: "asignacio_familiar", titulo: "ASIGNACION FAMILIAR", tipo: "importe", codigos: ["1040", "/I13", "/I11", "/I12"] },
  { clave: "cotizacion_afp", titulo: "COTIZACION AFP", tipo: "importe", codigos: ["MD01", "MD03", "MD61"] },
  { clave: "ahorro_voluntario", titulo: "AHORRO VOLUNTARIO", tipo: "importe", codigos: ["MD04"] },
  { clave: "apv_reg_a", titulo: "APV REG A", tipo: "importe", codigos: ["MD11"] },
  { clave: "apv_reg_b", titulo: "APV REG B", tipo: "importe", codigos: ["MD10"] },
  { clave: "cotizacion_adiciona_salud", titulo: "COTIZACION ADICIONAL SALUD", tipo: "importe", codigos: ["/302", "/303"] },
  { clave: "cotizacion_salud", titulo: "COTIZACION SALUD", tipo: "importe", codigos: ["/300", "/T13", "/T14"] },
  { clave: "seguro_cesantia", titulo: "SEGURO CESANTIA", tipo: "importe", codigos: ["MD09"] },
  { clave: "impuesto_renta", titulo: "IMPUESTO A LA RENTA", tipo: "importe", codigos: ["/312"] },
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
  { clave: "sobregiro_mes_anterior", titulo: "SOBREGIRO MES ANTERIOR", tipo: "importe", codigos: ["/563"] },
  { clave: "descuento_alojamiento", titulo: "DESCUENTO ALOJAMIENTO", tipo: "importe", codigos: ["7007"] },
  { clave: "descuento_fxr", titulo: "DESCUENTO FxR", tipo: "importe", codigos: ["7015"] },
  { clave: "descuento_por_ajuste", titulo: "DESCUENTO POR AJUSTE", tipo: "importe", codigos: ["7021"] },
  { clave: "ajuste_finiquito", titulo: "INDEMNNIZACIÓN CTP", tipo: "importe", codigos: ["/IF8"] },
  { clave: "prestamo_ccaf_los_andes", titulo: "PRESTAMO CCAF LOS ANDES", tipo: "importe", codigos: ["7032"] },
  { clave: "descuento_casona", titulo: "DESCUENTO CASONA", tipo: "importe", codigos: ["7010"] },
  { clave: "anticipo_finiquito", titulo: "ANTICIPO FINIQUITO", tipo: "importe", codigos: ["7046"] },
  { clave: "prestamo_empresa", titulo: "PRÉSTAMO EMPRESA", tipo: "importe", codigos: ["1041"] },
  { clave: "descuento_sobregiro", titulo: "DESCUENTO SOBREGIRO", tipo: "importe", codigos: ["7044"] },
  { clave: "desgaste_herramienta", titulo: "DESGASTE HERRAMIENTA", tipo: "importe", codigos: ["1020"] },
  { clave: "ausencia", titulo: "AUSENCIA", tipo: "importe", codigos: ["MT30"] },
  { clave: "licencia_medica", titulo: "LICENCIA MEDICA", tipo: "importe", codigos: ["MT70"] },
  { clave: "liquido_pago", titulo: "LIQUIDO A PAGO", tipo: "importe", codigos: ["/559"] },
  { clave: "aporte_afc", titulo: "APORTE AFC", tipo: "importe", codigos: ["/E01", "/E02", "/E03"] },
  { clave: "descuento_aporte_afc", titulo: "DESCUENTO APORTE AFC", tipo: "importe", codigos: ["7045"] },
  { clave: "desc_prestamo_empresa", titulo: "DESCUENTO PRESTAMO EMPRESA", tipo: "importe", codigos: ["7043"] },
  { clave: "mutual", titulo: "MUTUAL", tipo: "importe", codigos: ["/E04", "/E05", "/E10"] },
  { clave: "sis", titulo: "SIS", tipo: "importe", codigos: ["MD02", "/E08"] },
  { clave: "imponible", titulo: "IMPONIBLE", tipo: "imponible" },
  { clave: "trato", titulo: "TRATO", tipo: "importe", codigos: ["1031"] },
  { clave: "covid_19", titulo: "SUSP. REM COVID 19", tipo: "importe", codigos: ["1038"] },
  { clave: "diferencia_liquido", titulo: "DIFERENCIA LIQUIDO", tipo: "importe", codigos: ["1026"] },
  { clave: "anticipo_extraordinario", titulo: "ANTICIPO EXTRAORDINARIO", tipo: "importe", codigos: ["7003"] },
  { clave: "convenio_oftalm", titulo: "CONVENIO OFTALM. C.CH.C.", tipo: "importe", codigos: ["7006"] },
  { clave: "operativo_oftalm", titulo: "OPERATIVO OFTALMOLOGICO", tipo: "importe", codigos: ["7018"] },
  { clave: "descuento_equipo", titulo: "DESCUENTO EQUIPO", tipo: "importe", codigos: ["7014"] },
  { clave: "descuento_permiso_sindical", titulo: "DESCUENTO PERMISO SINDICAL", tipo: "importe", codigos: ["7020"] },
  { clave: "prestamo_ccaf_los_heroes", titulo: "PRÉSTAMO CCAF LOS HÉROES", tipo: "importe", codigos: ["7031"] },
  { clave: "diferencia_gratificacion", titulo: "DIFERENCIA GRATIFICACION", tipo: "importe", codigos: ["1024"] },
  { clave: "operativo_dental", titulo: "OPERATIVO DENTAL", tipo: "importe", codigos: ["7019"] },
  { clave: "dcto_ptmo_fonasa", titulo: "DCTO. PTMO FONASA", tipo: "importe", codigos: ["7022"] },
  { clave: "prestamo_curso", titulo: "PRESTAMO EN CURSO", tipo: "importe", codigos: ["7034"] },
  { clave: "desc_programa_mujer", titulo: "DESCUENTO PROGRAMA MUJER", tipo: "importe", codigos: ["7049"] },
  { clave: "apt_colecta_ayuda", titulo: "APT. COLECTA AYUDA", tipo: "importe", codigos: ["1006"] },
  { clave: "descuento_colecta", titulo: "DESCUENTO COLECTA", tipo: "importe", codigos: ["7012"] },
  { clave: "rem_pago_exceso", titulo: "REM PAGO EXCESO", tipo: "importe", codigos: ["7035"] },
];

/** Hoja «RESUMEN FINIQUITOS»: una fila por persona, CC y semana de pago. */
export const COLUMNAS_RESUMEN = [
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
  { clave: "dias_vacaciones", titulo: "DIAS VACACIONES" },
  { clave: "causal_termino", titulo: "CAUSAL TERMINO" },
  { clave: "liquido_pago", titulo: "LIQUIDO A PAGO" },
  { clave: "semana", titulo: "SEMANA" },
  { clave: "ames", titulo: "AMES" },
] as const;

/** Hoja «RESUMEN OBRA»: el líquido a pago por empresa, CC y semana de pago. */
export const COLUMNAS_OBRA = [
  { clave: "sociedad", titulo: "SOCIEDAD" },
  { clave: "cc", titulo: "CENTRO COSTO" },
  { clave: "liquido_pago", titulo: "LIQUIDO A PAGO" },
  { clave: "semana", titulo: "SEMANA" },
  { clave: "ames", titulo: "AMES" },
] as const;
