import {
  Bloco,
  CabecalhoEsqueleto,
  Carregando,
} from "@/components/ui/esqueleto";

export default function CarregandoTabela() {
  return (
    <Carregando rotulo="Carregando restrições…">
      <CabecalhoEsqueleto />
      <div className="mb-3 flex flex-wrap gap-2">
        <Bloco className="h-10 w-64 max-w-full" />
        <Bloco className="h-10 w-32" />
        <Bloco className="h-10 w-32" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--borda)] bg-white">
        <Bloco className="h-10 rounded-none" />
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-t border-[var(--grade)] px-3 py-3"
          >
            <Bloco className="h-4 w-12" />
            <Bloco className="h-5 w-20 rounded-full" />
            <Bloco className="h-4 flex-1" />
            <Bloco className="hidden h-4 w-28 sm:block" />
            <Bloco className="hidden h-4 w-20 md:block" />
          </div>
        ))}
      </div>
    </Carregando>
  );
}
