// ============================================================
// Genera el SQL para cargar ahorristas en bulk a partir del CSV
// 01-01-26_al_08-05-2026_solicitudes_PDA.csv (FIAT Plan).
//
// Uso:
//   node scripts/generate_ahorristas_seed.mjs <ruta-csv> > supabase/migrations/023_ahorristas_seed.sql
// ============================================================

import { readFileSync } from 'fs'

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Pasá la ruta del CSV como argumento')
  process.exit(1)
}

const raw = readFileSync(csvPath, 'utf-8')

// Quitar BOM si existe
const content = raw.replace(/^﻿/, '')

// Parsear CSV — separador `;`, campos pueden tener comas dentro
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const headers = lines[0].split(';').map(h => h.trim())
  return lines.slice(1).map(line => {
    const cols = line.split(';')
    const row = {}
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim() })
    return row
  })
}

// Map "Concepto de venta" → codigo_plan
function mapearCodigoPlan(concepto) {
  const c = concepto.toUpperCase()
  if (c.includes('70/30') && c.includes('CV'))     return 'B71'
  if (c.includes('70/30') && c.includes('CTA.VAR'))return 'B71'
  if (c.includes('70/30') && c.includes('D.S. 18'))return 'B70'
  if (c.includes('70/30') && c.includes('DYS 18')) return 'B71'
  if (c.includes('70/30'))                         return 'B72'
  if (c.includes('80/20') && c.includes('CV'))     return 'M80'
  if (c.includes('80/20'))                         return 'M81'
  if (c.includes('90/10'))                         return 'B90'
  if (c.includes('60/40') && c.includes('CV'))     return 'B61'
  if (c.includes('60/40') && c.includes('D.S.18')) return 'B61'
  if (c.includes('60/40'))                         return 'B60'
  return 'OTRO'
}

// Sanear nombre — quita caracteres raros tipo XX
function limpiarTexto(s) {
  if (!s) return null
  return s.replace(/XX/g, 'Ñ').replace(/ /g, ' ').trim() || null
}

// Mapear localidad → sucursal válida
function mapearSucursal(loc) {
  const u = (loc || '').toUpperCase()
  if (u.includes('RIO GRANDE')) return 'Rio Grande'
  return 'Ushuaia' // default (incluye USHUAIA, ushuaia, NO INFORMADA)
}

// Escapar string para SQL
function esc(v) {
  if (v == null || v === '') return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

const rows = parseCSV(content)
const valores = []

for (const r of rows) {
  // Detectar fila vacía
  if (!r['Solicitud']) continue

  const concepto = r['Concepto de venta'] || ''
  const codigoPlan = mapearCodigoPlan(concepto)
  const localidad = r['Localidad'] || ''
  const sucursal  = mapearSucursal(localidad)
  const dni       = r['Documento'] && r['Documento'] !== '0' ? r['Documento'] : (r['CUIT/CUIL'] || '')
  const nombre    = limpiarTexto(r['Apellido, Nombre']) || ''
  const grupo     = r['Grupo']
  const orden     = r['Orden']
  const fAgrup    = r['F.Agrupamiento'] || null
  const subite    = (r['Plan Subite'] || '').toUpperCase() === 'SI'
  const estado    = r['Estado'] || 'Solicitud Activa'
  const avance    = r['Avance'] || ''
  const dAut      = r['D.Aut.'] || ''
  const vendedor  = r['Vendedor'] || ''

  const observaciones = [
    `Loc: ${localidad}`,
    grupo ? `Grupo: ${grupo}` : '',
    `Estado: ${estado}`,
    avance ? `Avance: ${avance}` : '',
    dAut ? `D.Aut.: ${dAut}` : '',
    concepto ? `Plan: ${concepto}` : '',
  ].filter(Boolean).join(' · ')

  valores.push(
    `(${[
      esc(r['Solicitud']),                         // numero_solicitud
      esc(nombre),                                  // nombre_apellido
      esc(dni),                                     // dni_cuil
      esc(limpiarTexto(r['Dirección'] || r['Dirección'])), // domicilio
      esc(limpiarTexto(localidad)),                 // localidad
      esc(limpiarTexto(r['Teléfono'] || r['Teléfono'])),   // telefono
      esc(limpiarTexto(r['Mail'])),                 // email
      orden ? Number(orden) : 'NULL',               // numero_orden
      `'H'`,                                        // tipo_plan
      esc(codigoPlan),                              // codigo_plan
      esc(r['Modelo ahorro']),                      // vehiculo_codigo
      esc(limpiarTexto(r['Descripción de producto'] || r['Descripción de producto'])), // vehiculo_modelo
      '0',                                          // valor_movil (a completar)
      '0',                                          // cuota_pura (a completar)
      esc(fAgrup),                                  // fecha_arranque
      esc(limpiarTexto(vendedor)),                  // vendedor_nombre
      `'activo'`,                                   // estado
      esc(sucursal),                                // sucursal
      subite ? 'true' : 'false',                    // es_subite
      esc(observaciones),                           // observaciones
    ].join(', ')})`,
  )
}

// Generar el SQL
console.log(`-- =====================================================`)
console.log(`-- 023_ahorristas_seed.sql`)
console.log(`-- Carga inicial de ${valores.length} solicitudes Plan de Ahorro FIAT`)
console.log(`-- desde el CSV de SGA (período 01-01-2026 al 08-05-2026).`)
console.log(`--`)
console.log(`-- valor_movil y cuota_pura quedan en 0 (no vienen en el CSV) —`)
console.log(`-- completar después con los datos del valor móvil vigente.`)
console.log(`-- ON CONFLICT (numero_solicitud) DO NOTHING para que sea idempotente.`)
console.log(`-- =====================================================`)
console.log()
console.log(`INSERT INTO public.ahorristas`)
console.log(`  (numero_solicitud, nombre_apellido, dni_cuil, domicilio, localidad,`)
console.log(`   telefono, email, numero_orden, tipo_plan, codigo_plan,`)
console.log(`   vehiculo_codigo, vehiculo_modelo, valor_movil, cuota_pura,`)
console.log(`   fecha_arranque, vendedor_nombre, estado, sucursal, es_subite, observaciones)`)
console.log(`VALUES`)
console.log(valores.join(',\n'))
console.log(`ON CONFLICT (numero_solicitud) DO NOTHING;`)
console.log()
console.log(`-- Verificación`)
console.log(`SELECT sucursal, COUNT(*) AS solicitudes FROM public.ahorristas GROUP BY sucursal ORDER BY sucursal;`)
console.log(`SELECT vehiculo_codigo, COUNT(*) FROM public.ahorristas GROUP BY vehiculo_codigo ORDER BY vehiculo_codigo;`)
