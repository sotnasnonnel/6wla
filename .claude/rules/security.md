# Segurança

## Segredos
- `.env*` nunca é lido, editado ou commitado. `.env.example` documenta as chaves com valores fake.
- Chave real jamais aparece em log, mensagem de erro, teste ou comentário.
- `NEXT_PUBLIC_*` = público. Se é segredo, o nome não pode começar com isso.

## Entrada
- Toda entrada externa passa por Zod antes de tocar lógica ou banco.
- SQL sempre parametrizado / via client Supabase. Nada de template string com input em SQL.
- Nada de `dangerouslySetInnerHTML` sem sanitização explícita; nada de `eval`, `new Function`, `child_process` com input do usuário.

## Autorização
- Autenticação ≠ autorização. Toda Server Action e Route Handler checa **quem** pode fazer **aquilo naquele recurso**.
- Defesa em profundidade: checagem na aplicação **e** RLS no banco.
- Redirects e URLs vindos do usuário: validar contra allowlist (open redirect).

## Dependências
- `npm audit` antes de release. Nova dependência precisa de justificativa — prefira a stdlib/plataforma.
- Lock file nunca é editado à mão.

## Ao revisar
Rode o subagente `security-reviewer` em mudanças que tocam: auth, sessão, RLS, migrations, pagamento, upload, ou qualquer coisa em `src/server/admin/`.
