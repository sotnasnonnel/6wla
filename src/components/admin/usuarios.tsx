"use client";

import { useState, useTransition } from "react";
import { alternaAdmin, alternaAtivo } from "@/server/admin/usuarios";
import { Alerta, Botao, Cartao, Etiqueta } from "@/components/ui/basicos";

type Usuario = {
  id: string;
  nome: string;
  email: string;
  admin: boolean;
  ativo: boolean;
  criado_em: string;
  workspaces: string[];
};

/** Visão global (admin): todas as contas, com desativação e papel de admin global. */
export function AdminUsuarios({
  usuarios,
  meuId,
}: {
  usuarios: Usuario[];
  meuId: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, inicia] = useTransition();

  const roda = (
    fn: () => Promise<{ ok: boolean; erro?: string }>,
    msg: string,
  ) =>
    inicia(async () => {
      const r = await fn();
      if (r.ok) {
        setErro(null);
        setOk(msg);
      } else {
        setOk(null);
        setErro(r.erro ?? "Falha");
      }
    });

  return (
    <div className="space-y-4">
      {erro ? <Alerta>{erro}</Alerta> : null}
      {ok ? <Alerta tipo="ok">{ok}</Alerta> : null}
      <Cartao>
        <ul className="divide-y divide-[var(--grade)]">
          {usuarios.map((u) => (
            <li
              key={u.id}
              className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:py-2"
            >
              <div className="min-w-0 flex-1">
                <div
                  className={
                    u.ativo ? "text-[var(--tinta-forte)]" : "text-[var(--tinta-fraca)] line-through"
                  }
                >
                  {u.nome}
                </div>
                <div className="text-xs text-[var(--tinta-fraca)]">
                  {u.email}
                  {u.workspaces.length > 0
                    ? ` · ${u.workspaces.join(", ")}`
                    : " · sem workspace"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              {u.admin ? <Etiqueta tom="roxo">admin global</Etiqueta> : null}
              {!u.ativo ? <Etiqueta tom="vermelho">desativado</Etiqueta> : null}
              {u.id !== meuId ? (
                <>
                  <Botao
                    variante="fantasma"
                    disabled={pendente}
                    onClick={() => {
                      const f = new FormData();
                      f.set("userId", u.id);
                      f.set("admin", String(!u.admin));
                      roda(() => alternaAdmin(f), "Papel atualizado.");
                    }}
                  >
                    {u.admin ? "tirar admin global" : "tornar admin global"}
                  </Botao>
                  <Botao
                    variante="fantasma"
                    disabled={pendente}
                    onClick={() => {
                      const f = new FormData();
                      f.set("userId", u.id);
                      f.set("ativo", String(!u.ativo));
                      roda(
                        () => alternaAtivo(f),
                        u.ativo ? "Usuário desativado." : "Usuário reativado.",
                      );
                    }}
                  >
                    {u.ativo ? "desativar" : "reativar"}
                  </Botao>
                </>
              ) : (
                <span className="text-xs text-[var(--tinta-fraca)]">você</span>
              )}
              </div>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}
