/**
 * setup-director.mjs — Crea el usuario director inicial en LASAC.
 *
 * USO:
 *   node scripts/setup-director.mjs
 *
 * VARIABLES DE ENTORNO REQUERIDAS (podés setearlas antes de correr):
 *   SUPABASE_URL          = https://ftagdiyrmocoqxlyeona.supabase.co
 *   SUPABASE_SERVICE_KEY  = (service_role key — Supabase → Project Settings → API)
 *   DIRECTOR_EMAIL        = tu-email@liendoautomotores.com.ar
 *   DIRECTOR_PASSWORD     = tu-contraseña-actual
 *   DIRECTOR_NOMBRE       = "Nombre Apellido"
 *   DIRECTOR_SUCURSAL     = Ambas  (o "Ushuaia" / "Rio Grande")
 */

import { createClient } from '@supabase/supabase-js'
import readline from 'readline'

const ask = (q) => new Promise(r => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.question(q, ans => { rl.close(); r(ans.trim()) })
})

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ftagdiyrmocoqxlyeona.supabase.co'

async function main() {
  console.log('\n=== LASAC — Setup Director ===\n')

  const serviceKey = process.env.SUPABASE_SERVICE_KEY
    || await ask('Service Role Key (Supabase → Project Settings → API): ')

  const email = process.env.DIRECTOR_EMAIL
    || await ask('Email del director: ')

  const password = process.env.DIRECTOR_PASSWORD
    || await ask('Contraseña: ')

  const nombre = process.env.DIRECTOR_NOMBRE
    || await ask('Nombre completo: ')

  const sucursal = process.env.DIRECTOR_SUCURSAL
    || await ask('Sucursal [Ushuaia / Rio Grande / Ambas]: ')

  // Cliente con service key (bypasa RLS)
  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // 1. Obtener o crear el usuario en auth
  console.log('\n→ Buscando usuario en auth...')
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) throw new Error('Error listando usuarios: ' + listErr.message)

  let authUser = users.find(u => u.email === email)

  if (!authUser) {
    console.log('→ No existe en auth, creando...')
    const { data: { user }, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) throw new Error('Error creando usuario auth: ' + createErr.message)
    authUser = user
    console.log('✓ Usuario auth creado:', authUser.id)
  } else {
    console.log('✓ Usuario auth encontrado:', authUser.id)
  }

  // 2. Insertar en tabla usuarios (bypassando RLS con service key)
  console.log('→ Insertando perfil en tabla usuarios...')
  const { error: insertErr } = await supabase
    .from('usuarios')
    .upsert({
      id: authUser.id,
      email: authUser.email,
      nombre_completo: nombre,
      rol: 'director',
      sucursal: sucursal || 'Ambas',
      activo: true,
    }, { onConflict: 'id' })

  if (insertErr) throw new Error('Error insertando perfil: ' + insertErr.message)

  console.log('\n✅ Listo! Director creado correctamente.')
  console.log(`   UUID:    ${authUser.id}`)
  console.log(`   Email:   ${authUser.email}`)
  console.log(`   Nombre:  ${nombre}`)
  console.log(`   Rol:     director`)
  console.log(`   Sucursal: ${sucursal || 'Ambas'}`)
  console.log('\nPodés iniciar sesión en la app ahora.\n')
}

main().catch(err => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
