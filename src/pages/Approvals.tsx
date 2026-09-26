import { Empty, PageHeader } from '../components/ui'

export default function Approvals() {
  return (
    <div>
      <PageHeader title="Tasdiqlash" sub="Marja/limit oshgan sotuvlar, taʼtil soʻrovlari" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
