import { Empty, PageHeader } from '../components/ui'

export default function Sales() {
  return (
    <div>
      <PageHeader title="Sotuv" sub="Kunlik sotuv jurnali, sotuv kiritish, reja/fakt" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
