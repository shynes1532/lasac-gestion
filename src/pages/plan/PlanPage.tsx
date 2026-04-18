import { useState } from 'react'
import { Tabs } from '../../components/ui'
import { AhorristasPage } from '../ahorristas/AhorristasPage'
import { CarteraPage } from '../cartera/CarteraPage'
import { GestionMoraPage } from '../mora/GestionMoraPage'

const tabs = [
  { id: 'ahorristas', label: 'Ahorristas' },
  { id: 'cartera',    label: 'Cartera' },
  { id: 'mora',       label: 'Mora' },
]

export function PlanPage() {
  const [tab, setTab] = useState('ahorristas')

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-4">Plan de Ahorro</h1>
      <Tabs tabs={tabs} activeTab={tab} onChange={setTab} className="mb-6" />

      {tab === 'ahorristas' && <AhorristasPage />}
      {tab === 'cartera' && <CarteraPage />}
      {tab === 'mora' && <GestionMoraPage />}
    </div>
  )
}
