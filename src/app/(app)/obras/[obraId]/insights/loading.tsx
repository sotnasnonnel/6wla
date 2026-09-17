import {
  Bloco,
  CabecalhoEsqueleto,
  Carregando,
} from "@/components/ui/esqueleto";

export default function CarregandoInsights() {
  return (
    <Carregando rotulo="Carregando insights…">
      <CabecalhoEsqueleto />
      <Bloco className="mb-5 h-28 w-full rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-xl border border-[var(--borda)] bg-white p-4"
          >
            <Bloco className="h-8 w-14" />
            <div className="flex-1 space-y-2">
              <Bloco className="h-4 w-48 max-w-full" />
              <Bloco className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </Carregando>
  );
}
