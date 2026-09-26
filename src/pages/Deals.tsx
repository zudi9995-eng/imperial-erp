import { Empty, PageHeader } from '../components/ui'

export default function Deals() {
  return (
    <div>
      <PageHeader title="Voronka" sub="Bitimlar kanbani, bosqichlar, yoʻqotish sabablari" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
