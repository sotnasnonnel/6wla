import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase";

/**
 * Convite por e-mail: a conta nasce sem senha e a pessoa cria a dela pelo
 * link (/definir-senha). Quem chama estas funções já fez a autorização.
 */

/** Nunca entrou: nem pelo link do convite, nem com senha. */
export function convitePendente(user: Pick<User, "last_sign_in_at">): boolean {
  return !user.last_sign_in_at;
}

/** Até aqui, uma consulta por conta; acima, a lista paginada sai mais barata. */
const LIMITE_CONSULTA_INDIVIDUAL = 25;
const POR_PAGINA = 1000;

/**
 * Das contas informadas, quais ainda não entraram. É só um aviso na tela:
 * se o Auth falhar, loga e trata a conta como não pendente, sem derrubar a
 * página.
 */
export async function contasComConvitePendente(
  ids: readonly string[],
): Promise<Set<string>> {
  const pendentes = new Set<string>();
  if (ids.length === 0) return pendentes;
  const admin = createAdminClient();

  if (ids.length <= LIMITE_CONSULTA_INDIVIDUAL) {
    const contas = await Promise.all(
      ids.map((id) => admin.auth.admin.getUserById(id)),
    );
    for (const { data, error } of contas) {
      if (error) console.error("[convites.pendentes.conta]", error);
      else if (convitePendente(data.user)) pendentes.add(data.user.id);
    }
    return pendentes;
  }

  // O banco é dividido com o PHD View: a lista traz contas de lá também.
  const alvo = new Set(ids);
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page: pagina,
      perPage: POR_PAGINA,
    });
    if (error) {
      console.error("[convites.pendentes.lista]", error);
      return pendentes;
    }
    for (const u of data.users) {
      if (alvo.has(u.id) && convitePendente(u)) pendentes.add(u.id);
    }
    if (data.users.length < POR_PAGINA) return pendentes;
  }
}

type Convite =
  { ok: true; id: string } | { ok: false; jaExiste: boolean; erro: unknown };

/**
 * Manda o e-mail de convite. `data` vira o `user_metadata` da conta nova —
 * o `app_origem` ali é lido pelo gatilho do PHD View no INSERT (não cria
 * perfil lá). Para conta ainda não confirmada o Auth reenvia o convite; para
 * conta confirmada ele recusa (`email_exists`).
 */
export async function enviaConvite(
  email: string,
  nome: string,
  appOrigem: string,
  redirectTo: string,
): Promise<Convite> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome, app_origem: appOrigem },
    redirectTo,
  });
  if (error) {
    return {
      ok: false,
      jaExiste: error.code === "email_exists" || error.status === 422,
      erro: error,
    };
  }
  return { ok: true, id: data.user.id };
}
