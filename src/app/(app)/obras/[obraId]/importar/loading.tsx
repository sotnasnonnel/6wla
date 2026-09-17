import {
  Bloco,
  CabecalhoEsqueleto,
  Carregando,
} from "@/components/ui/esqueleto";

export default function CarregandoImportar() {
  return (
    <Carregando rotulo="Carregando importação…">
      <div className="max-w-3xl space-y-4">
        <CabecalhoEsqueleto />
        <Bloco className="h-6 w-80 max-w-full" />
        <Bloco className="h-56 rounded-xl" />
      </div>
    </Carregando>
  );
}
