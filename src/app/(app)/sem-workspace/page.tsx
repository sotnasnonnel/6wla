import { exigeUsuario } from "@/server/auth";
import { Cartao, CabecalhoPagina } from "@/components/ui/basicos";

export default async function PaginaSemWorkspace() {
  const { perfil } = await exigeUsuario();
  return (
    <div className="max-w-lg">
      <CabecalhoPagina titulo={`Olá, ${perfil.nome}`} apoio={perfil.email} />
      <Cartao>
        <p className="text-sm text-[var(--tinta-media)]">
          Sua conta ainda não está em nenhum workspace. Peça ao administrador da
          sua empresa para incluir você (ele faz isso em Pessoas, pelo seu
          e-mail).
        </p>
      </Cartao>
    </div>
  );
}
