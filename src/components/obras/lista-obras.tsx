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
  Etiqueta,
  Vazio,
} from "@/components/ui/basicos";
import { filtraPorTermo } from "@/components/ui/busca";
import { BotaoCopiar } from "@/components/ui/copiar";
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

const COR_CONCLUIDA = "#00a49a";
const COR_ATRASADA = "var(--marca-terracotta-vermelho)";

/** Acima disso a lista ganha busca: até 6 cartões cabem numa olhada. */
const LIMITE_SEM_BUSCA = 6;

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
  meuEmail,
}: {
  obras: ObraResumo[];
  podeCriar: boolean;
  workspaceId: string;
  workspaceNome: string;
  /** Para o membro sem obra repassar ao gestor. */
  meuEmail: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");

  // Inativas por último; a ordem por código se mantém dentro de cada grupo.
  const ordenadas = [...obras].sort(
    (a, b) => Number(!a.ativa) - Number(!b.ativa),
  );
  const visiveis = filtraPorTermo(ordenadas, termo, (o) => [o.codigo, o.nome]);
  const temResumo = obras.some((o) => o.total > 0);

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
          titulo={
            podeCriar
              ? "Nenhuma obra ainda"
              : "Você ainda não está em nenhuma obra"
          }
          descricao={
            podeCriar
              ? "Crie a primeira obra e depois monte a equipe dela."
              : "Peça ao gestor da obra para incluir você na equipe. Ele vai precisar do seu e-mail."
          }
          acao={
            podeCriar ? (
              <Botao onClick={() => setAberto(true)}>Criar obra</Botao>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <BotaoCopiar texto={meuEmail} rotulo="Copiar meu e-mail" />
              </div>
            )
          }
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            {obras.length > LIMITE_SEM_BUSCA ? (
              <div className="w-full max-w-sm">
                <Campo
                  type="search"
                  value={termo}
                  onChange={(ev) => setTermo(ev.target.value)}
                  placeholder="Buscar por código ou nome"
                  aria-label="Buscar obra"
                />
              </div>
            ) : null}
            {temResumo ? <LegendaBarra /> : null}
          </div>

          {visiveis.length === 0 ? (
            <Vazio
              titulo="Nenhuma obra com esse código ou nome"
              descricao="Confira a grafia ou limpe a busca."
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visiveis.map((o) => (
                <li key={o.id}>
                  <CartaoObra obra={o} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ModalCriarObra
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}

function LegendaBarra() {
  return (
    <div className="flex items-center gap-4 text-xs text-[var(--tinta-fraca)]">
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-3 rounded-sm"
          style={{ background: COR_CONCLUIDA }}
        />
        concluídas
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-3 rounded-sm"
          style={{ background: COR_ATRASADA }}
        />
        atrasadas
      </span>
    </div>
  );
}

/**
 * Cartão com link esticado para os indicadores; "Abrir tabela" fica por cima
 * como segundo destino (link dentro de link não é HTML válido).
 */
function CartaoObra({ obra: o }: { obra: ObraResumo }) {
  return (
    <div
      className={`group relative flex h-full flex-col rounded-xl border border-[var(--borda)] px-[22px] pt-5 pb-3 shadow-[var(--sombra-sm)] transition hover:border-[var(--marca-brand-200)] hover:shadow-[var(--sombra-md)] ${
        o.ativa ? "bg-white" : "bg-[var(--plano)]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-[var(--marca-azul)]">
          {o.codigo}
        </span>
        {!o.ativa ? <Etiqueta>Inativa</Etiqueta> : null}
      </div>
      <Link
        href={`/obras/${o.id}/indicadores`}
        className="mt-1 font-medium text-[var(--tinta-forte)] after:absolute after:inset-0 after:rounded-xl group-hover:text-[var(--marca-terracotta)]"
      >
        {o.nome}
      </Link>

      {o.total === 0 ? (
        <p className="mt-3 text-sm text-[var(--tinta-fraca)]">
          Sem restrições ainda
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-end gap-5">
            <Numero valor={o.concluidas} rotulo="concluídas" cor="#00706a" />
            <Numero valor={o.abertas} rotulo="em aberto" />
            <Numero valor={o.atrasadas} rotulo="atrasadas" cor={COR_ATRASADA} />
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
            aria-label={`${o.concluidas} de ${o.total} restrições concluídas, ${o.atrasadas} atrasadas`}
          >
            <span
              style={{
                width: `${(o.concluidas / o.total) * 100}%`,
                background: COR_CONCLUIDA,
              }}
            />
            <span
              style={{
                width: `${(o.atrasadas / o.total) * 100}%`,
                background: COR_ATRASADA,
              }}
            />
          </div>
        </>
      )}

      <div className="relative z-10 mt-auto flex justify-end pt-2">
        <Link
          href={`/obras/${o.id}/tabela`}
          className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-[var(--tinta-media)] transition hover:bg-[var(--marca-gelo)] hover:text-[var(--marca-terracotta)]"
        >
          Abrir tabela →
        </Link>
      </div>
    </div>
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
  // Fechar descarta o erro da tentativa anterior.
  const fecha = () => {
    if (pendente) return;
    setErro(null);
    aoFechar();
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={fecha}
      titulo="Criar obra"
      descricao="A obra é o contexto de trabalho: restrições, indicadores e importações ficam dentro dela."
      largura={520}
      rodape={
        <>
          <Botao variante="secundario" onClick={fecha} disabled={pendente}>
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
            router.push(`/obras/${r.dados.id}/equipe`);
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
            data-autofocus
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
