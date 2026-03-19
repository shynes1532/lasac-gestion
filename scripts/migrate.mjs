import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nnstpnszppqojlujkdna.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uc3RwbnN6cHBxb2psdWprZG5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU0MTg2NSwiZXhwIjoyMDg5MTE3ODY1fQ.B9FdE1nynFhH9o4QBw6CyeWAkAfqoKpjZZsg57S9mqo'
const PROJECT_REF = 'nnstpnszppqojlujkdna'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Verificar columnas existentes
console.log('Verificando schema actual...')
const { data: cols, error: colsErr } = await sb
  .from('information_schema.columns')
  .select('column_name')
  .eq('table_schema', 'public')
  .eq('table_name', 'operaciones')

if (colsErr) {
  console.log('No se puede leer information_schema:', colsErr.message)

  // Alternativa: probar insertar un registro con los campos nuevos
  console.log('Probando si las columnas existen...')
  const { error: e1 } = await sb.from('operaciones').select('nro_epod').limit(1)
  console.log('nro_epod:', e1 ? '✗ No existe: ' + e1.message : '✓ Existe')

  const { error: e2 } = await sb.from('operaciones').select('cliente_nombre').limit(1)
  console.log('cliente_nombre:', e2 ? '✗ No existe: ' + e2.message : '✓ Existe')

  const { error: e3 } = await sb.from('contactos_calidad').select('id').limit(1)
  console.log('contactos_calidad:', e3 ? '✗ No existe: ' + e3.message : '✓ Existe')
} else {
  const colNames = cols.map(c => c.column_name)
  const needed = ['nro_epod', 'cliente_nombre', 'cliente_telefono', 'forma_pago', 'estado_prenda', 'estado_paso1']
  needed.forEach(c => {
    console.log(c + ':', colNames.includes(c) ? '✓' : '✗ FALTA')
  })
}

// Intento crear función SQL para ejecutar DDL
console.log('\nCreando función exec_ddl...')
const createFn = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
  method: 'POST',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    // No hay endpoint directo para DDL
  })
})
console.log('Status:', createFn.status)
