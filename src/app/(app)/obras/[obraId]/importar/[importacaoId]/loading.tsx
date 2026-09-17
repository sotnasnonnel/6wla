import {
  Bloco,
  CabecalhoEsqueleto,
  Carregando,
} from "@/components/ui/esqueleto";

export default function CarregandoConferencia() {
  return (
    <Carregando rotulo="Carregando conferência…">
      <CabecalhoEsqueleto />
      <Bloco className="mb-4 h-6 w-80 max-w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco className="h-96 rounded-xl" />
        <Bloco className="h-96 rounded-xl" />
      </div>
    </Carregando>
  );
}
