import { Empty, PageHeader } from '../components/ui'

export default function Receivables() {
  return (
    <div>
      <PageHeader title="Debitor" sub="Qarilik tahlili, qoʻngʻiroq navbati, toʻlov kiritish" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
