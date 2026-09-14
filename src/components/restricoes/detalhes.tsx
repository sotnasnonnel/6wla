"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizaRestricao,
  excluiRestricao,
} from "@/server/restricoes/actions";
import type { Restricao } from "@/server/restricoes/queries";
import type { Membro } from "@/server/obras/queries";
import type { RestricaoEditavel } from "@/lib/restricoes/schemas";
import {
  PRIORIDADES,
  PRIORIDADE_ROTULO,
  STATUS,
  STATUS_ROTULO,
} from "@/lib/restricoes/dominio";
import {
  Alerta,
  AreaTexto,
  Botao,
  Campo,
  Rotulo,
  Selecao,
} from "@/components/ui/basicos";

type Props = {
  restricao: Restricao;
  membros: Membro[];
  papel: "gestor" | "membro";
};

function v(s: string | null): string {
  return s ?? "";
}

/** Formulário completo da restrição (lado esquerdo da tela de detalhes). */
export function DetalhesRestricao({ restricao: r, membros, papel }: Props) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, inicia] = useTransition();
  const baseTravada = papel !== "gestor" && !!r.semana_programada;

  const enviar = (form: FormData) => {
    const pega = (k: keyof RestricaoEditavel) => String(form.get(k) ?? "");
    const entrada: Partial<RestricaoEditavel> = {
      codigo: pega("codigo") || null,
      descricao: pega("descricao"),
      acao: pega("acao") || null,
      responsavel_id: pega("responsavel_id") || null,
      responsavel_nome: pega("responsavel_nome") || null,
      responsavel_email: pega("responsavel_email") || null,
      responsavel_telefone: pega("responsavel_telefone") || null,
      status: pega("status") as RestricaoEditavel["status"],
      prioridade: pega("prioridade") as RestricaoEditavel["prioridade"],
      descricao_status: pega("descricao_status") || null,
      causa_6m: pega("causa_6m") || null,
      classificacao: pega("classificacao") || null,
      area: pega("area") || null,
      setor: pega("setor") || null,
      localizacao: pega("localizacao") || null,
      id_atividade: pega("id_atividade") || null,
      atividade_impactada: pega("atividade_impactada") || null,
      inicio_atividade: pega("inicio_atividade") || null,
      data_criacao: pega("data_criacao"),
      data_limite: pega("data_limite") || null,
      previsao_conclusao: pega("previsao_conclusao") || null,
      data_conclusao: pega("data_conclusao") || null,
      observacoes: pega("observacoes") || null,
    };
    if (!baseTravada)
      entrada.semana_programada = pega("semana_programada") || null;

    inicia(async () => {
      const res = await atualizaRestricao(r.id, entrada);
      if (!res.ok) {
        setErro(res.erro);
        setSalvo(false);
        return;
      }
      setErro(null);
      setSalvo(true);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        enviar(new FormData(ev.currentTarget));
      }}
      className="space-y-4"
    >
      <div>
        <Rotulo htmlFor="descricao">Restrição</Rotulo>
        <AreaTexto
          id="descricao"
          name="descricao"
          defaultValue={r.descricao}
          rows={3}
          required
        />
      </div>
      <div>
        <Rotulo htmlFor="acao">Ação</Rotulo>
        <AreaTexto id="acao" name="acao" defaultValue={v(r.acao)} rows={2} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor="status">Status</Rotulo>
          <Selecao id="status" name="status" defaultValue={r.status}>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS_ROTULO[s]}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="prioridade">Prioridade</Rotulo>
          <Selecao
            id="prioridade"
            name="prioridade"
            defaultValue={r.prioridade}
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {PRIORIDADE_ROTULO[p]}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="responsavel_id">Responsável (usuário)</Rotulo>
          <Selecao
            id="responsavel_id"
            name="responsavel_id"
            defaultValue={v(r.responsavel_id)}
          >
            <option value="">— nenhum —</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="responsavel_nome">Responsável (texto)</Rotulo>
          <Campo
            id="responsavel_nome"
            name="responsavel_nome"
            defaultValue={v(r.responsavel_nome)}
          />
        </div>
        <div>
          <Rotulo htmlFor="responsavel_email">E-mail do responsável</Rotulo>
          <Campo
            id="responsavel_email"
            name="responsavel_email"
            defaultValue={v(r.responsavel_email)}
          />
        </div>
        <div>
          <Rotulo htmlFor="responsavel_telefone">Telefone</Rotulo>
          <Campo
            id="responsavel_telefone"
            name="responsavel_telefone"
            defaultValue={v(r.responsavel_telefone)}
          />
        </div>

        <div>
          <Rotulo htmlFor="data_criacao">Criada em</Rotulo>
          <Campo
            id="data_criacao"
            name="data_criacao"
            type="date"
            defaultValue={r.data_criacao}
            required
          />
        </div>
        <div>
          <Rotulo htmlFor="data_limite">Prazo (data limite)</Rotulo>
          <Campo
            id="data_limite"
            name="data_limite"
            type="date"
            defaultValue={v(r.data_limite)}
          />
          {r.prazo_original && r.prazo_original !== r.data_limite ? (
            <p className="mt-1 text-xs text-[#8a4a12]">
              Prazo original {r.prazo_original.split("-").reverse().join("/")} ·{" "}
              {r.reprogramacoes} reprogramação(ões)
            </p>
          ) : null}
        </div>
        <div>
          <Rotulo htmlFor="previsao_conclusao">Previsão de conclusão</Rotulo>
          <Campo
            id="previsao_conclusao"
            name="previsao_conclusao"
            type="date"
            defaultValue={v(r.previsao_conclusao)}
          />
        </div>
        <div>
          <Rotulo htmlFor="data_conclusao">Concluída em</Rotulo>
          <Campo
            id="data_conclusao"
            name="data_conclusao"
            type="date"
            defaultValue={v(r.data_conclusao)}
          />
        </div>

        <div>
          <Rotulo htmlFor="semana_programada">
            Semana programada (linha de base)
          </Rotulo>
          <Campo
            id="semana_programada"
            name="semana_programada"
            defaultValue={v(r.semana_programada)}
            disabled={baseTravada}
            title={baseTravada ? "Só gestor da obra altera" : undefined}
            placeholder="S-20"
          />
        </div>
        <div>
          <Rotulo htmlFor="codigo">Código na planilha</Rotulo>
          <Campo id="codigo" name="codigo" defaultValue={v(r.codigo)} />
        </div>

        <div>
          <Rotulo htmlFor="causa_6m">Causa 6M</Rotulo>
          <Campo
            id="causa_6m"
            name="causa_6m"
            defaultValue={v(r.causa_6m)}
            list="lista-6m"
          />
          <datalist id="lista-6m">
            {[
              "Método",
              "Material",
              "Máquina",
              "Mão de obra",
              "Medida",
              "Meio ambiente",
              "Segurança",
            ].map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
        <div>
          <Rotulo htmlFor="classificacao">Classificação</Rotulo>
          <Campo
            id="classificacao"
            name="classificacao"
            defaultValue={v(r.classificacao)}
          />
        </div>
        <div>
          <Rotulo htmlFor="area">Área</Rotulo>
          <Campo id="area" name="area" defaultValue={v(r.area)} />
        </div>
        <div>
          <Rotulo htmlFor="setor">Setor</Rotulo>
          <Campo id="setor" name="setor" defaultValue={v(r.setor)} />
        </div>
        <div>
          <Rotulo htmlFor="localizacao">Local</Rotulo>
          <Campo
            id="localizacao"
            name="localizacao"
            defaultValue={v(r.localizacao)}
          />
        </div>
        <div>
          <Rotulo htmlFor="id_atividade">ID da atividade</Rotulo>
          <Campo
            id="id_atividade"
            name="id_atividade"
            defaultValue={v(r.id_atividade)}
          />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="atividade_impactada">Atividade impactada</Rotulo>
          <Campo
            id="atividade_impactada"
            name="atividade_impactada"
            defaultValue={v(r.atividade_impactada)}
          />
        </div>
        <div>
          <Rotulo htmlFor="inicio_atividade">Início da atividade</Rotulo>
          <Campo
            id="inicio_atividade"
            name="inicio_atividade"
            type="date"
            defaultValue={v(r.inicio_atividade)}
          />
        </div>
      </div>

      <div>
        <Rotulo htmlFor="descricao_status">Situação (texto livre)</Rotulo>
        <AreaTexto
          id="descricao_status"
          name="descricao_status"
          defaultValue={v(r.descricao_status)}
          rows={2}
        />
      </div>
      <div>
        <Rotulo htmlFor="observacoes">Observações</Rotulo>
        <AreaTexto
          id="observacoes"
          name="observacoes"
          defaultValue={v(r.observacoes)}
          rows={2}
        />
      </div>

      {Object.keys(r.extras as Record<string, unknown>).length > 0 ? (
        <details className="rounded-md border border-[var(--borda)] bg-[var(--marca-gelo)] p-3 text-sm">
          <summary className="cursor-pointer font-medium text-[var(--tinta-media)]">
            Outras colunas da planilha
          </summary>
          <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
            {Object.entries(r.extras as Record<string, string>).map(
              ([k, val]) => (
                <div key={k} className="contents">
                  <dt className="text-[var(--tinta-fraca)]">{k}</dt>
                  <dd className="text-[var(--tinta-forte)]">{String(val)}</dd>
                </div>
              ),
            )}
          </dl>
        </details>
      ) : null}

      {erro ? <Alerta>{erro}</Alerta> : null}
      {salvo && !erro ? <Alerta tipo="ok">Alterações salvas.</Alerta> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Botao
          type="submit"
          disabled={pendente}
          className="flex-1 py-2 sm:flex-none sm:py-1.5"
        >
          {pendente ? "Salvando…" : "Salvar"}
        </Botao>
        {papel === "gestor" ? (
          <Botao
            variante="perigo"
            className="flex-1 py-2 sm:flex-none sm:py-1.5"
            disabled={pendente}
            onClick={() => {
              if (
                !window.confirm(
                  "Excluir esta restrição? O chat e o histórico vão junto.",
                )
              )
                return;
              inicia(async () => {
                const res = await excluiRestricao(r.id);
                if (!res.ok) setErro(res.erro);
                else router.push(`/obras/${r.obra_id}`);
              });
            }}
          >
            Excluir
          </Botao>
        ) : null}
      </div>
    </form>
  );
}
