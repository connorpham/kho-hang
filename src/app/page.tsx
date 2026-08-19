import { vi } from '@/lib/i18n/vi'

export default function Page() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{vi.app.ten}</h1>
      <p className="text-foreground/70">{vi.app.moTa}</p>

      <hr className="my-2 border-foreground/15" />

      <h2 className="text-lg font-medium">{vi.base.tieuDe}</h2>
      <p className="text-foreground/70">{vi.base.ghiChu}</p>
      <p className="font-mono text-sm text-foreground/60">
        {vi.base.nhanTienDo}: 0 / 20
      </p>
    </main>
  )
}
