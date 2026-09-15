"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviaAnexo, removeAnexo, urlAnexo } from "@/server/restricoes/anexos";
import type { Anexo } from "@/server/restricoes/queries";
import {
  ehImagem,
  formataTamanho,
  tipoDeArquivo,
  TAMANHO_MAXIMO_ANEXO,
} from "@/lib/restricoes/anexos";
import { Alerta, Botao } from "@/components/ui/basicos";

type Props = {
  restricaoId: string;
  anexos: Anexo[];
  papel: "gestor" | "membro";
};

function quando(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Lista de anexos da restrição. Vários arquivos por restrição: uma foto da
 * frente de serviço, o projeto e o e-mail do fornecedor contam a mesma
 * história e ficam juntos.
 *
 * Só o gestor anexa e apaga; o membro vê, baixa e discute no chat. O botão
 * some para quem não pode — e a RLS recusa de qualquer jeito.
 */
export function AnexosRestricao({ restricaoId, anexos, papel }: Props) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, inicia] = useTransition();
  const [ocupadoCom, setOcupadoCom] = useState<string | null>(null);

  const enviar = (arquivos: FileList | null) => {
    if (!arquivos || arquivos.length === 0) return;
    const escolhidos = [...arquivos];
    const grande = escolhidos.find((a) => a.size > TAMANHO_MAXIMO_ANEXO);
    if (grande) {
      setErro(
        `"${grande.name}" tem ${formataTamanho(grande.size)}; o limite por arquivo é 10 MB.`,
      );
      return;
    }
    setErro(null);
    inicia(async () => {
      // Um de cada vez: o erro aponta o arquivo que falhou, e o servidor não
      // leva dez uploads simultâneos por conta de um arrastar de pasta.
      for (const arquivo of escolhidos) {
        const form = new FormData();
        form.set("restricaoId", restricaoId);
        form.set("arquivo", arquivo);
        const res = await enviaAnexo(form);
        if (!res.ok) {
          setErro(`${arquivo.name}: ${res.erro}`);
          break;
        }
      }
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    });
  };

  /**
   * Abrir mostra o arquivo (imagem e PDF aparecem na aba nova); baixar salva
   * com o nome original. Nos dois casos o link é assinado na hora — o bucket
   * é privado e o endereço vence em um minuto.
   */
  const abrir = (anexo: Anexo, paraBaixar: boolean) => {
    setOcupadoCom(anexo.id);
    inicia(async () => {
      const res = await urlAnexo(anexo.id, paraBaixar);
      setOcupadoCom(null);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      window.open(res.dados, "_blank", "noopener");
    });
  };

  const apagar = (anexo: Anexo) => {
    if (!window.confirm(`Apagar "${anexo.nome}"? Não dá para desfazer.`))
      return;
    inicia(async () => {
      const res = await removeAnexo(anexo.id);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setErro(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {erro ? <Alerta>{erro}</Alerta> : null}

      {anexos.length === 0 ? (
        <p className="py-2 text-sm text-[var(--tinta-fraca)]">
          {papel === "gestor"
            ? "Nenhum anexo. Junte foto, projeto ou e-mail que ajude a resolver a restrição."
            : "Nenhum anexo nesta restrição."}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--grade)]">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center gap-1 py-2">
              <button
                type="button"
                onClick={() => abrir(a, false)}
                disabled={ocupado}
                title={`Abrir "${a.nome}"`}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded px-1 py-1 text-left transition hover:bg-[var(--marca-gelo)] disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[9px] font-semibold tracking-tight text-white"
                  // Imagem em verde, resto em cinza: dá para varrer a lista e
                  // achar a foto sem ler nome de arquivo.
                  style={{
                    background: ehImagem(a.tipo_mime) ? "#00a49a" : "#94a3b8",
                  }}
                >
                  {tipoDeArquivo(a.nome, a.tipo_mime).slice(0, 4)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-[var(--tinta-forte)]">
                    {a.nome}
                  </span>
                  <span className="block text-[11px] text-[var(--tinta-fraca)]">
                    {ocupadoCom === a.id
                      ? "Abrindo…"
                      : `${formataTamanho(a.tamanho)} · ${a.autor?.nome ?? "usuário removido"} · ${quando(a.criado_em)}`}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => abrir(a, true)}
                disabled={ocupado}
                title="Baixar o arquivo"
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-[var(--marca-terracotta)] transition hover:bg-[var(--marca-gelo)] disabled:opacity-60"
              >
                Baixar
              </button>
              {papel === "gestor" ? (
                <button
                  type="button"
                  onClick={() => apagar(a)}
                  disabled={ocupado}
                  title="Apagar anexo"
                  className="shrink-0 rounded px-2 py-1 text-xs text-[var(--tinta-fraca)] transition hover:bg-[var(--perigo-fundo)] hover:text-[var(--marca-terracotta-vermelho)] disabled:opacity-60"
                >
                  Apagar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {papel === "gestor" ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            ref={entrada}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => enviar(e.target.files)}
          />
          <Botao
            variante="secundario"
            disabled={ocupado}
            onClick={() => entrada.current?.click()}
          >
            {ocupado ? "Enviando…" : "Adicionar anexos"}
          </Botao>
          <span className="text-[11px] text-[var(--tinta-fraca)]">
            Vários arquivos de uma vez, até 10 MB cada.
          </span>
        </div>
      ) : null}
    </div>
  );
}
