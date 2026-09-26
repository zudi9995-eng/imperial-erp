import { Empty, PageHeader } from '../components/ui'

export default function Products() {
  return (
    <div>
      <PageHeader title="Tovar va narx" sub="Nomenklatura, narx roʻyxati, toifa boʻyicha narxlar" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
