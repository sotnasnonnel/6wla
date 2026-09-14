import { exigeUsuario } from "@/server/auth";
import { FormSenha } from "./form-senha";
import { Cartao, CabecalhoPagina } from "@/components/ui/basicos";

export default async function PaginaConta() {
  const { perfil } = await exigeUsuario();
  return (
    <div className="max-w-md space-y-4">
      <CabecalhoPagina titulo="Sua conta" apoio={`${perfil.nome} · ${perfil.email}`} />
      <Cartao>
        <h2 className="mb-3 text-sm font-semibold text-[var(--tinta-forte)]">
          Trocar senha
        </h2>
        <FormSenha />
      </Cartao>
    </div>
  );
}
