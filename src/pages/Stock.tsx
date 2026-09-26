import { Empty, PageHeader } from '../components/ui'

export default function Stock() {
  return (
    <div>
      <PageHeader title="Ombor" sub="Qoldiq, partiya (FIFO), signallar, koʻchirish, inventarizatsiya" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
