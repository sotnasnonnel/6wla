import { FormLogin } from "./form-login";

export const metadata = { title: "Entrar · Restrições 6WLA" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  const { proximo, erro } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--marca-gelo)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--borda)] bg-white p-7 shadow-[var(--sombra-md)]">
        <h1 className="text-xl font-bold tracking-[-0.02em] text-[var(--tinta-forte)]">
          Controle de Restrições
        </h1>
        <p className="mb-5 text-sm text-[var(--tinta-fraca)]">
          6WLA · Last Planner System
        </p>
        <FormLogin
          proximo={proximo ?? ""}
          avisoInicial={
            erro === "inativo" ? "Sua conta está desativada." : undefined
          }
        />
      </div>
    </main>
  );
}
