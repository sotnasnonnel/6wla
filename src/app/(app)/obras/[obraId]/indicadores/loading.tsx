import {
  Bloco,
  CabecalhoEsqueleto,
  Carregando,
} from "@/components/ui/esqueleto";

export default function CarregandoIndicadores() {
  return (
    <Carregando rotulo="Carregando indicadores…">
      <CabecalhoEsqueleto />
      <Bloco className="mb-3 h-10 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-[var(--borda)] bg-white p-4"
          >
            <Bloco className="h-3 w-20" />
            <Bloco className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Bloco key={i} className="h-14 rounded-lg" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Bloco className="h-72 rounded-xl" />
        <Bloco className="h-72 rounded-xl" />
      </div>
    </Carregando>
  );
}
