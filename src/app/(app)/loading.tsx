import {
  Bloco,
  CabecalhoEsqueleto,
  Carregando,
} from "@/components/ui/esqueleto";

/** Carregamento genérico das telas do app (obras, administração, conta). */
export default function CarregandoApp() {
  return (
    <Carregando rotulo="Carregando…">
      <CabecalhoEsqueleto />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-[var(--borda)] bg-white px-[22px] py-5"
          >
            <Bloco className="h-3 w-16" />
            <Bloco className="h-5 w-3/4" />
            <Bloco className="h-2 w-full" />
          </div>
        ))}
      </div>
    </Carregando>
  );
}
