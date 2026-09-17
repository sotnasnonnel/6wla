import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase";

/**
 * Conta com senha inicial (definida por quem cadastrou) precisa trocar a
 * senha antes de usar o app: quem cadastrou conhece essa senha. A marca fica
 * no `app_metadata`, que o próprio usuário não consegue editar.
 *
 * LEGADO: contas novas nascem por convite por e-mail e ninguém grava mais
 * esta marca. A leitura continua para contas antigas que ainda a tenham.
 */
export const MARCA_TROCA_SENHA = "troca_senha";

export function precisaTrocarSenha(user: Pick<User, "app_metadata">): boolean {
  return user.app_metadata[MARCA_TROCA_SENHA] === true;
}

/**
 * Liga ou desliga a marca. O Auth mescla `app_metadata` por chave, mas a
 * cópia completa evita depender disso.
 */
export async function marcaTrocaSenha(user: User, ligada: boolean) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, [MARCA_TROCA_SENHA]: ligada },
  });
  return error;
}
