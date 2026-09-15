"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criaObra } from "@/server/obras/actions";
import {
  Alerta,
  Botao,
  Campo,
  CampoRotulado,
  Vazio,
} from "@/components/ui/basicos";
import { Modal } from "@/components/ui/modal";

export type ObraResumo = {
  id: string;
  codigo: string;
  nome: string;
  ativa: boolean;
  abertas: number;
  atrasadas: number;
  concluidas: number;
  total: number;
};

/**
 * Porta de entrada do workspace: as obras que a pessoa acompanha, cada uma
 * mostrando o que exige atenção agora (abertas e, dentro delas, atrasadas).
 * Entrar numa obra troca o contexto do sistema inteiro.
 */
export function ListaObras({
  obras,
  podeCriar,
  workspaceId,
  workspaceNome,
}: {
  obras: ObraResumo[];
  podeCriar: boolean;
  workspaceId: string;
  workspaceNome: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-7">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--tinta-forte)]">
            Obras
          </h1>
          <p className="mt-0.5 text-sm text-[var(--tinta-fraca)]">
            {obras.length > 0
              ? `${obras.length} ${obras.length === 1 ? "obra" : "obras"} em ${workspaceNome}`
              : workspaceNome}
          </p>
        </div>
        {podeCriar ? (
          <Botao onClick={() => setAberto(true)}>Criar obra</Botao>
        ) : null}
      </div>

      {obras.length === 0 ? (
        <Vazio
          titulo="Nenhuma obra neste workspace"
          descricao={
            podeCriar
              ? "Crie a primeira obra para começar a registrar restrições."
              : "Peça ao administrador do workspace para criar a obra e incluir você."
          }
          acao={
            podeCriar ? (
              <Botao onClick={() => setAberto(true)}>Criar obra</Botao>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {obras.map((o) => (
            <li key={o.id}>
              <Link
                href={`/obras/${o.id}/indicadores`}
                className="group block rounded-xl border border-[var(--borda)] bg-white px-[22px] py-5 shadow-[var(--sombra-sm)] transition hover:border-[var(--marca-brand-200)] hover:shadow-[var(--sombra-md)]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--marca-azul)]">
                    {o.codigo}
                  </span>
                  {!o.ativa ? (
                    <span className="text-xs text-[var(--tinta-fraca)]">
                      inativa
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 font-medium text-[var(--tinta-forte)] group-hover:text-[var(--marca-terracotta)]">
                  {o.nome}
                </div>

                {o.total === 0 ? (
                  <p className="mt-3 text-sm text-[var(--tinta-fraca)]">
                    Sem restrições ainda
                  </p>
                ) : (
                  <>
                    <div className="mt-3 flex items-end gap-5">
                      <Numero
                        valor={o.concluidas}
                        rotulo="concluídas"
                        cor="#00706a"
                      />
                      <Numero valor={o.abertas} rotulo="em aberto" />
                      <Numero
                        valor={o.atrasadas}
                        rotulo="atrasadas"
                        cor="var(--marca-terracotta-vermelho)"
                      />
                      <div className="ml-auto text-right">
                        <div className="text-sm font-medium tabular-nums text-[var(--tinta-media)]">
                          {o.total}
                        </div>
                        <div className="text-xs text-[var(--tinta-fraca)]">no total</div>
                      </div>
                    </div>
                    {/* Barra de progresso: quanto da obra já saiu do caminho. */}
                    <div
                      className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[var(--grade)]"
                      role="img"
                      aria-label={`${o.concluidas} de ${o.total} restrições concluídas`}
                    >
                      <span
                        style={{ width: `${(o.concluidas / o.total) * 100}%`, background: "#00a49a" }}
                      />
                      <span
                        style={{
                          width: `${(o.atrasadas / o.total) * 100}%`,
                          background: "var(--marca-terracotta-vermelho)",
                        }}
                      />
                    </div>
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ModalCriarObra
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}

/** Número grande com rótulo curto, o formato dos cartões de obra. */
function Numero({
  valor,
  rotulo,
  cor = "var(--tinta-forte)",
}: {
  valor: number;
  rotulo: string;
  cor?: string;
}) {
  return (
    <div>
      <div
        className="text-2xl leading-none font-semibold tabular-nums"
        style={{ color: valor > 0 ? cor : "var(--tinta-fraca)" }}
      >
        {valor}
      </div>
      <div
        className="mt-1 text-xs"
        style={{ color: valor > 0 ? cor : "var(--tinta-fraca)" }}
      >
        {rotulo}
      </div>
    </div>
  );
}

function ModalCriarObra({
  aberto,
  aoFechar,
  workspaceId,
}: {
  aberto: boolean;
  aoFechar: () => void;
  workspaceId: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Criar obra"
      descricao="A obra é o contexto de trabalho: restrições, indicadores e importações ficam dentro dela."
      largura={520}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={pendente}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-criar-obra" disabled={pendente}>
            {pendente ? "Criando…" : "Criar obra"}
          </Botao>
        </>
      }
    >
      <form
        id="form-criar-obra"
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          const form = ev.currentTarget;
          const dados = new FormData(form);
          dados.set("workspaceId", workspaceId);
          inicia(async () => {
            const r = await criaObra(dados);
            if (!r.ok) {
              setErro(r.erro);
              return;
            }
            setErro(null);
            form.reset();
            aoFechar();
            router.push(`/obras/${r.dados.id}/tabela`);
          });
        }}
      >
        <CampoRotulado
          id="codigo"
          rotulo="Código"
          dica="como a obra aparece nas listas"
        >
          <Campo
            id="codigo"
            name="codigo"
            required
            autoFocus
            maxLength={30}
            placeholder="HRMS"
          />
        </CampoRotulado>
        <CampoRotulado id="nome" rotulo="Nome">
          <Campo
            id="nome"
            name="nome"
            required
            maxLength={120}
            placeholder="Hospital Regional de Mato Grosso do Sul"
          />
        </CampoRotulado>
        {erro ? <Alerta>{erro}</Alerta> : null}
      </form>
    </Modal>
  );
}
