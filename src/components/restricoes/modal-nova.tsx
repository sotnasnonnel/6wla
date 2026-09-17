"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criaRestricao } from "@/server/restricoes/actions";
import type { Membro } from "@/server/obras/queries";
import {
  PRIORIDADES,
  PRIORIDADE_ROTULO,
  hojeIso,
} from "@/lib/restricoes/dominio";
import {
  Alerta,
  AreaTexto,
  Botao,
  Campo,
  CampoRotulado,
  Selecao,
} from "@/components/ui/basicos";
import { Modal } from "@/components/ui/modal";

/**
 * Cadastro de restrição em modal, com todos os campos da tabela.
 *
 * A ordem dos campos segue a conversa da reunião de planejamento: o que trava
 * (restrição), o que resolve (ação), quem resolve, até quando, e só então a
 * classificação, que é o que alimenta os indicadores mas ninguém preenche
 * primeiro.
 */
export function ModalNovaRestricao({
  obraId,
  membros,
  aberto,
  aoFechar,
}: {
  obraId: string;
  membros: Membro[];
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();
  // O modal mantém o formulário montado ao fechar; "alterado" diz se há
  // rascunho a perder quando a pessoa pede para fechar.
  const [alterado, setAlterado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const limpa = () => {
    formRef.current?.reset();
    setAlterado(false);
    setErro(null);
  };

  const pedeFechar = () => {
    if (pendente) return;
    if (alterado && !window.confirm("Descartar alterações?")) return;
    limpa();
    aoFechar();
  };

  const enviar = (form: HTMLFormElement) => {
    const d = new FormData(form);
    const txt = (k: string) => {
      const v = String(d.get(k) ?? "").trim();
      return v.length > 0 ? v : null;
    };
    inicia(async () => {
      const r = await criaRestricao({
        obraId,
        descricao: String(d.get("descricao") ?? ""),
        acao: txt("acao"),
        responsavel_id: txt("responsavel_id"),
        responsavel_nome: txt("responsavel_nome"),
        prioridade: String(d.get("prioridade") ?? "media"),
        data_criacao: txt("data_criacao"),
        data_limite: txt("data_limite"),
        previsao_conclusao: txt("previsao_conclusao"),
        causa_6m: txt("causa_6m"),
        classificacao: txt("classificacao"),
        area: txt("area"),
        setor: txt("setor"),
        localizacao: txt("localizacao"),
        id_atividade: txt("id_atividade"),
        atividade_impactada: txt("atividade_impactada"),
        inicio_atividade: txt("inicio_atividade"),
        semana_programada: txt("semana_programada"),
        observacoes: txt("observacoes"),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      limpa();
      aoFechar();
      router.refresh();
    });
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={pedeFechar}
      bloqueado={pendente}
      titulo="Adicionar restrição"
      descricao="Só a descrição é obrigatória. O resto dá para completar depois, direto na tabela."
      largura={860}
      rodape={
        <>
          <Botao variante="secundario" onClick={pedeFechar} disabled={pendente}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-nova-restricao" disabled={pendente}>
            {pendente ? "Adicionando…" : "Adicionar restrição"}
          </Botao>
        </>
      }
    >
      <form
        ref={formRef}
        id="form-nova-restricao"
        onInput={() => setAlterado(true)}
        onChange={() => setAlterado(true)}
        onSubmit={(ev) => {
          ev.preventDefault();
          enviar(ev.currentTarget);
        }}
        className="space-y-4"
      >
        <CampoRotulado id="descricao" rotulo="Restrição">
          <AreaTexto
            id="descricao"
            name="descricao"
            rows={2}
            required
            data-autofocus
            maxLength={4000}
            placeholder="O que está impedindo a atividade de acontecer"
          />
        </CampoRotulado>

        <CampoRotulado id="acao" rotulo="Ação">
          <AreaTexto
            id="acao"
            name="acao"
            rows={2}
            maxLength={4000}
            placeholder="O que precisa ser feito para remover"
          />
        </CampoRotulado>

        <div className="grid gap-3 sm:grid-cols-3">
          <CampoRotulado id="responsavel_id" rotulo="Responsável">
            <Selecao id="responsavel_id" name="responsavel_id" defaultValue="">
              <option value="">Escolha uma pessoa</option>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Selecao>
          </CampoRotulado>
          <CampoRotulado
            id="responsavel_nome"
            rotulo="Responsável externo"
            dica="sem conta no sistema"
          >
            <Campo
              id="responsavel_nome"
              name="responsavel_nome"
              placeholder="Nome"
            />
          </CampoRotulado>
          <CampoRotulado id="prioridade" rotulo="Prioridade">
            <Selecao id="prioridade" name="prioridade" defaultValue="media">
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {PRIORIDADE_ROTULO[p]}
                </option>
              ))}
            </Selecao>
          </CampoRotulado>
        </div>

        <fieldset className="rounded-lg border border-[var(--borda)] p-3">
          <legend className="px-1 text-[13px] font-medium text-[var(--tinta-media)]">
            Prazos
          </legend>
          <div className="grid gap-3 sm:grid-cols-4">
            <CampoRotulado id="data_criacao" rotulo="Identificada em">
              <Campo
                id="data_criacao"
                name="data_criacao"
                type="date"
                defaultValue={hojeIso()}
              />
            </CampoRotulado>
            <CampoRotulado id="data_limite" rotulo="Prazo">
              <Campo id="data_limite" name="data_limite" type="date" />
            </CampoRotulado>
            <CampoRotulado id="previsao_conclusao" rotulo="Previsão">
              <Campo
                id="previsao_conclusao"
                name="previsao_conclusao"
                type="date"
              />
            </CampoRotulado>
            <CampoRotulado id="semana_programada" rotulo="Semana">
              <Campo
                id="semana_programada"
                name="semana_programada"
                placeholder="S-20"
              />
            </CampoRotulado>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-[var(--borda)] p-3">
          <legend className="px-1 text-[13px] font-medium text-[var(--tinta-media)]">
            Classificação
          </legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CampoRotulado id="causa_6m" rotulo="Causa 6M">
              <Campo
                id="causa_6m"
                name="causa_6m"
                list="lista-6m"
                placeholder="Método"
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
            </CampoRotulado>
            <CampoRotulado id="classificacao" rotulo="Classificação">
              <Campo
                id="classificacao"
                name="classificacao"
                placeholder="Projeto"
              />
            </CampoRotulado>
            <CampoRotulado id="area" rotulo="Área">
              <Campo id="area" name="area" placeholder="Secagem" />
            </CampoRotulado>
            <CampoRotulado id="setor" rotulo="Setor">
              <Campo id="setor" name="setor" placeholder="Engenharia" />
            </CampoRotulado>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-[var(--borda)] p-3">
          <legend className="px-1 text-[13px] font-medium text-[var(--tinta-media)]">
            Atividade impactada
          </legend>
          <div className="grid gap-3 sm:grid-cols-4">
            <CampoRotulado
              id="atividade_impactada"
              rotulo="Atividade"
              className="sm:col-span-2"
            >
              <Campo
                id="atividade_impactada"
                name="atividade_impactada"
                placeholder="Concretagem do bloco B"
              />
            </CampoRotulado>
            <CampoRotulado id="id_atividade" rotulo="Código no cronograma">
              <Campo
                id="id_atividade"
                name="id_atividade"
                placeholder="1.10.2"
              />
            </CampoRotulado>
            <CampoRotulado id="inicio_atividade" rotulo="Início da atividade">
              <Campo
                id="inicio_atividade"
                name="inicio_atividade"
                type="date"
              />
            </CampoRotulado>
            <CampoRotulado
              id="localizacao"
              rotulo="Local"
              className="sm:col-span-2"
            >
              <Campo id="localizacao" name="localizacao" placeholder="Eixo 4" />
            </CampoRotulado>
          </div>
        </fieldset>

        <CampoRotulado id="observacoes" rotulo="Observações">
          <AreaTexto
            id="observacoes"
            name="observacoes"
            rows={2}
            maxLength={4000}
          />
        </CampoRotulado>

        {erro ? <Alerta>{erro}</Alerta> : null}
      </form>
    </Modal>
  );
}
