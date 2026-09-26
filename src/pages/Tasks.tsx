import { Empty, PageHeader } from '../components/ui'

export default function Tasks() {
  return (
    <div>
      <PageHeader title="Vazifalar" sub="Topshiriqlar, AI tavsiya qilgan vazifalar" />
      <Empty
        title="Bu boʻlim qurilmoqda"
        hint="Baza tayyor, interfeys navbatda. Sozlamalar boʻlimidan bu modulning parametrlarini hoziroq oʻzgartirishingiz mumkin."
      />
    </div>
  )
}
