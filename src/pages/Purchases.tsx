import { Empty, PageHeader } from '../components/ui'

export default function Purchases() {
  return (
    <div>
      <PageHeader title="Xaridlar" sub="Postavshiklar, prixod hujjati, partiya yaratish" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
