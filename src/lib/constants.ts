import type {
  EstadoGestoria,
  EstadoAlistamiento,
  EstadoEntrega,
  EstadoActual,
  TipoOperacion,
  Sucursal,
  RolUsuario,
  ChecklistDocItem,
  ChecklistPDIItem,
} from './types'

// ============================================================
// Estados con label y color Tailwind para badges
// ============================================================

interface EstadoConfig {
  label: string
  color: string // clase Tailwind para bg + text
}

export const ESTADOS_GESTORIA: Record<EstadoGestoria, EstadoConfig> = {
  ingresado: { label: 'Ingresado', color: 'bg-blue-100 text-blue-800' },
  en_tramite: { label: 'En trámite', color: 'bg-yellow-100 text-yellow-800' },
  listo: { label: 'Listo', color: 'bg-green-100 text-green-800' },
  egresado: { label: 'Egresado', color: 'bg-gray-100 text-gray-800' },
  suspendido: { label: 'Suspendido', color: 'bg-red-100 text-red-800' },
}

export const ESTADOS_ALISTAMIENTO: Record<EstadoAlistamiento, EstadoConfig> = {
  pendiente: { label: 'Pendiente', color: 'bg-gray-100 text-gray-800' },
  en_proceso: { label: 'En proceso', color: 'bg-blue-100 text-blue-800' },
  observado: { label: 'Observado', color: 'bg-orange-100 text-orange-800' },
  aprobado: { label: 'Aprobado', color: 'bg-green-100 text-green-800' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800' },
}

export const ESTADOS_ENTREGA: Record<EstadoEntrega, EstadoConfig> = {
  pendiente: { label: 'Pendiente', color: 'bg-gray-100 text-gray-800' },
  programada: { label: 'Programada', color: 'bg-blue-100 text-blue-800' },
  entregada: { label: 'Entregada', color: 'bg-green-100 text-green-800' },
  cerrada: { label: 'Cerrada', color: 'bg-slate-100 text-slate-800' },
}

// Colores generales para el estado_actual de la operación
export const COLORES_ESTADO: Record<EstadoActual, string> = {
  gestoria: 'bg-purple-100 text-purple-800',
  alistamiento: 'bg-blue-100 text-blue-800',
  entrega: 'bg-amber-100 text-amber-800',
  cerrada: 'bg-green-100 text-green-800',
}

// ============================================================
// Tipos de operación
// ============================================================

export const TIPOS_OPERACION: { value: TipoOperacion; label: string }[] = [
  { value: '0KM', label: '0 KM' },
  { value: 'Plan de Ahorro', label: 'Plan de Ahorro' },
  { value: 'Usado', label: 'Usado' },
]

// ============================================================
// Sucursales
// ============================================================

export const SUCURSALES: { value: Sucursal; label: string }[] = [
  { value: 'Ushuaia', label: 'Ushuaia' },
  { value: 'Rio Grande', label: 'Río Grande' },
]

// ============================================================
// Roles
// ============================================================

export const ROLES: { value: RolUsuario; label: string }[] = [
  { value: 'director', label: 'Director' },
  { value: 'asesor_ush', label: 'Asesor Ushuaia' },
  { value: 'asesor_rg', label: 'Asesor Río Grande' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'preparador', label: 'Preparador' },
  { value: 'calidad', label: 'Calidad' },
]

// ============================================================
// Template Checklist Documentación 0KM
// ============================================================

export const CHECKLIST_DOC_0KM: ChecklistDocItem[] = [
  { id: 1, nombre: 'Solicitud de inscripción inicial (F01)', completado: false, observacion: '' },
  { id: 2, nombre: 'Factura de venta original', completado: false, observacion: '' },
  { id: 3, nombre: 'Certificado de fabricación / importación', completado: false, observacion: '' },
  { id: 4, nombre: 'CETA (Certificado de Transferencia Automotor)', completado: false, observacion: '' },
  { id: 5, nombre: 'DNI titular (frente y dorso)', completado: false, observacion: '' },
  { id: 6, nombre: 'CUIL / CUIT titular', completado: false, observacion: '' },
  { id: 7, nombre: 'Comprobante de domicilio', completado: false, observacion: '' },
  { id: 8, nombre: 'Formulario 08 firmado', completado: false, observacion: '' },
  { id: 9, nombre: 'Seguro automotor vigente', completado: false, observacion: '' },
  { id: 10, nombre: 'Verificación policial', completado: false, observacion: '' },
  { id: 11, nombre: 'Pago de aranceles registrales', completado: false, observacion: '' },
  { id: 12, nombre: 'Declaración jurada de datos personales', completado: false, observacion: '' },
  { id: 13, nombre: 'Poder notarial (si corresponde)', completado: false, observacion: '' },
  { id: 14, nombre: 'Constancia de AFIP (monotributo o resp. inscripto)', completado: false, observacion: '' },
]

// ============================================================
// Template Checklist PDI (Pre-Delivery Inspection)
// 10 secciones con 3-5 items cada una
// ============================================================

export const CHECKLIST_PDI_TEMPLATE: ChecklistPDIItem[] = [
  // --- 1. Exterior - Carrocería ---
  { id: 1, seccion: 'Exterior - Carrocería', item: 'Estado general de pintura (sin rayas, golpes ni imperfecciones)', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 2, seccion: 'Exterior - Carrocería', item: 'Paneles alineados y sin diferencias de color', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 3, seccion: 'Exterior - Carrocería', item: 'Parabrisas y luneta sin fisuras ni rayones', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 4, seccion: 'Exterior - Carrocería', item: 'Burletes de puertas y baúl en buen estado', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 5, seccion: 'Exterior - Carrocería', item: 'Vidrios laterales sin defectos', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },

  // --- 2. Exterior - Iluminación ---
  { id: 6, seccion: 'Exterior - Iluminación', item: 'Faros delanteros funcionando (baja, alta, posición)', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 7, seccion: 'Exterior - Iluminación', item: 'Luces traseras, stop y marcha atrás', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 8, seccion: 'Exterior - Iluminación', item: 'Giros delanteros y traseros', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 9, seccion: 'Exterior - Iluminación', item: 'Balizas funcionando correctamente', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 10, seccion: 'Exterior - Iluminación', item: 'Luz de patente', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },

  // --- 3. Interior - Habitáculo ---
  { id: 11, seccion: 'Interior - Habitáculo', item: 'Tapizado sin manchas, roturas ni defectos', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 12, seccion: 'Interior - Habitáculo', item: 'Cinturones de seguridad funcionando (todos los asientos)', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 13, seccion: 'Interior - Habitáculo', item: 'Espejos retrovisores interior y exteriores', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 14, seccion: 'Interior - Habitáculo', item: 'Alfombras y protectores en posición', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 15, seccion: 'Interior - Habitáculo', item: 'Guantera y compartimientos sin defectos', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },

  // --- 4. Interior - Tablero e Instrumentos ---
  { id: 16, seccion: 'Interior - Tablero e Instrumentos', item: 'Tablero sin testigos de error encendidos', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 17, seccion: 'Interior - Tablero e Instrumentos', item: 'Velocímetro, tacómetro y nivel de combustible operativos', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 18, seccion: 'Interior - Tablero e Instrumentos', item: 'Bocina funcionando', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 19, seccion: 'Interior - Tablero e Instrumentos', item: 'Comandos de volante operativos', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },

  // --- 5. Climatización y Confort ---
  { id: 20, seccion: 'Climatización y Confort', item: 'Aire acondicionado enfría correctamente', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 21, seccion: 'Climatización y Confort', item: 'Calefacción funciona en todas las velocidades', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 22, seccion: 'Climatización y Confort', item: 'Desempañador trasero operativo', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 23, seccion: 'Climatización y Confort', item: 'Limpiaparabrisas y lavaparabrisas', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },

  // --- 6. Sistema Multimedia ---
  { id: 24, seccion: 'Sistema Multimedia', item: 'Radio / pantalla multimedia enciende', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 25, seccion: 'Sistema Multimedia', item: 'Parlantes sin distorsión', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 26, seccion: 'Sistema Multimedia', item: 'Conexión Bluetooth / USB / Android Auto / Apple CarPlay', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 27, seccion: 'Sistema Multimedia', item: 'Cámara de retroceso (si aplica)', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },

  // --- 7. Motor y Compartimiento ---
  { id: 28, seccion: 'Motor y Compartimiento', item: 'Nivel de aceite correcto', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 29, seccion: 'Motor y Compartimiento', item: 'Nivel de refrigerante correcto', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 30, seccion: 'Motor y Compartimiento', item: 'Nivel de líquido de frenos correcto', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 31, seccion: 'Motor y Compartimiento', item: 'Sin pérdidas visibles de fluidos', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 32, seccion: 'Motor y Compartimiento', item: 'Batería con carga adecuada y bornes limpios', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },

  // --- 8. Neumáticos y Ruedas ---
  { id: 33, seccion: 'Neumáticos y Ruedas', item: 'Presión de inflado correcta (4 ruedas + auxilio)', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 34, seccion: 'Neumáticos y Ruedas', item: 'Neumáticos sin defectos ni desgaste irregular', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 35, seccion: 'Neumáticos y Ruedas', item: 'Llantas sin golpes ni rayones', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 36, seccion: 'Neumáticos y Ruedas', item: 'Rueda de auxilio y herramientas presentes', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },

  // --- 9. Frenos y Seguridad ---
  { id: 37, seccion: 'Frenos y Seguridad', item: 'Freno de servicio responde correctamente', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 38, seccion: 'Frenos y Seguridad', item: 'Freno de estacionamiento funciona', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 39, seccion: 'Frenos y Seguridad', item: 'Airbags sin testigos de falla', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 40, seccion: 'Frenos y Seguridad', item: 'ABS / ESP sin alertas', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },

  // --- 10. Accesorios y Documentación de Unidad ---
  { id: 41, seccion: 'Accesorios y Documentación', item: 'Manual de usuario presente', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 42, seccion: 'Accesorios y Documentación', item: 'Libreta de mantenimiento / service', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 43, seccion: 'Accesorios y Documentación', item: 'Juego de llaves completo (2 llaves + tarjeta si aplica)', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 44, seccion: 'Accesorios y Documentación', item: 'Matafuego y balizas triangulares', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 45, seccion: 'Accesorios y Documentación', item: 'Chaleco reflectante', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
]
