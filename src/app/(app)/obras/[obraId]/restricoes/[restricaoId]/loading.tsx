import { Bloco, Carregando } from "@/components/ui/esqueleto";

/** Mesma geometria da página: cabeçalho, barra de status e duas colunas. */
export default function CarregandoRestricao() {
  return (
    <Carregando rotulo="Carregando restrição…">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="space-y-2">
          <Bloco className="h-3 w-32" />
          <Bloco className="h-7 w-2/3" />
          <Bloco className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Bloco key={i} className="h-10" />
          ))}
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`space-y-3 rounded-xl border border-[var(--borda)] bg-white px-5 py-4 ${i === 0 ? "md:col-span-2" : ""}`}
              >
                <Bloco className="h-3 w-24" />
                <Bloco className="h-4 w-full" />
                <Bloco className="h-4 w-2/3" />
              </div>
            ))}
          </div>
          <div className="h-[620px] space-y-4 rounded-xl border border-[var(--borda)] bg-white p-5 lg:h-[calc(100vh-3rem)]">
            <Bloco className="h-4 w-28" />
            <Bloco className="h-14 w-3/4" />
            <Bloco className="ml-auto h-14 w-2/3" />
            <Bloco className="h-6 w-1/2" />
          </div>
        </div>
      </div>
    </Carregando>
  );
}
