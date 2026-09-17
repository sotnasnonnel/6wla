/**
 * Blocos cinza no formato do conteúdo que está chegando. Usados pelos
 * `loading.tsx`: o clique responde na hora, e o layout não pula quando os
 * dados chegam. Sem animação para quem pediu movimento reduzido.
 */
export function Bloco({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-[var(--grade)] motion-reduce:animate-none ${className}`}
    />
  );
}

/** Envolve um esqueleto e anuncia o carregamento para leitores de tela. */
export function Carregando({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{rotulo}</span>
      {children}
    </div>
  );
}

export function CabecalhoEsqueleto() {
  return (
    <div className="mb-6 space-y-2 sm:mb-7">
      <Bloco className="h-7 w-48" />
      <Bloco className="h-4 w-72 max-w-full" />
    </div>
  );
}
