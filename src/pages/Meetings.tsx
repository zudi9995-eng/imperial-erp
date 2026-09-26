import { Empty, PageHeader } from '../components/ui'

export default function Meetings() {
  return (
    <div>
      <PageHeader title="Uchrashuvlar" sub="Kalendar, Google Calendar sinxronizatsiyasi" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
