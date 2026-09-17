import {
  Bloco,
  CabecalhoEsqueleto,
  Carregando,
} from "@/components/ui/esqueleto";

export default function CarregandoAutomacoes() {
  return (
    <Carregando rotulo="Carregando automações…">
      <CabecalhoEsqueleto />
      <div className="space-y-3">
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-[var(--borda)] bg-white p-4"
          >
            <div className="flex-1 space-y-2">
              <Bloco className="h-5 w-56 max-w-full" />
              <Bloco className="h-4 w-80 max-w-full" />
            </div>
            <Bloco className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>
      <Bloco className="mt-8 h-48" />
    </Carregando>
  );
}
