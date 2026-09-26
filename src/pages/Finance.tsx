import { Empty, PageHeader } from '../components/ui'

export default function Finance() {
  return (
    <div>
      <PageHeader title="Moliya va P&L" sub="Foyda-zarar, naqd oqim, byudjet, qarzlar, stsenariy" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
