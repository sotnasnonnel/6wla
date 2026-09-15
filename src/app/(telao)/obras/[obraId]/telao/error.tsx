"use client";
export default function Erro({ retry }: { retry: () => void }) {
  return (
    <main className="grid min-h-screen place-content-center gap-4 bg-slate-950 p-8 text-center text-white">
      <h1 className="text-2xl">Não foi possível atualizar o telão</h1>
      <p>Confira a conexão e tente novamente.</p>
      <button onClick={retry} className="rounded border p-3">
        Tentar novamente
      </button>
    </main>
  );
}
