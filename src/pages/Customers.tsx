import { Empty, PageHeader } from '../components/ui'

export default function Customers() {
  return (
    <div>
      <PageHeader title="Mijozlar" sub="Mijoz kartochkasi, qarz, marja, aloqa tarixi" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
