import { Empty, PageHeader } from '../components/ui'

export default function Hr() {
  return (
    <div>
      <PageHeader title="Xodimlar" sub="Hisob ochish, KPI, davomat, taʼtil, oylik va bonus" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
