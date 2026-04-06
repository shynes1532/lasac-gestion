export type TipoConsulta = 'administracion' | 'ventas' | 'postventa' | 'repuestos'
export type EstadoVisita = 'en_espera' | 'atendido' | 'finalizado'

export interface VisitaRecepcion {
  id: string
  visitante_nombre: string
  visitante_telefono: string | null
  visitante_email: string | null
  sucursal: string
  tipo_consulta: TipoConsulta
  estado: EstadoVisita
  fecha_hora_ingreso: string
  fecha_hora_atencion: string | null
  fecha_hora_finalizacion: string | null
  admin_motivo: string | null
  admin_resuelto: boolean | null
  admin_observaciones: string | null
  ventas_asesor_asignado: string | null
  ventas_consulta_resuelta: boolean | null
  ventas_calificacion_atencion: number | null
  ventas_quiere_que_lo_llamen: boolean | null
  ventas_telefono_callback: string | null
  observaciones: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
