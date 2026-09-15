-- Seed SOMENTE para desenvolvimento local (npx supabase db reset).
-- Nunca roda em produção. Senhas fracas de propósito.

-- Usuários de desenvolvimento.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@6wla.local', crypt('senha123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"app_origem":"6wla"}', '{"nome":"Admin Global"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'gestor@6wla.local', crypt('senha123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"app_origem":"6wla"}', '{"nome":"Gestora do Workspace"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'membro@6wla.local', crypt('senha123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"app_origem":"6wla"}', '{"nome":"Membro da Equipe"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'outro@6wla.local', crypt('senha123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"app_origem":"6wla"}', '{"nome":"Admin do Outro Workspace"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@6wla.local';

-- Sem gatilho em auth.users (banco compartilhado com o PHD View): o perfil
-- do 6wla é criado explicitamente, como faz o cadastro do admin.
insert into public."6wla_perfis" (id, email, nome, admin)
select u.id, lower(u.email), u.raw_user_meta_data ->> 'nome',
       u.id = '00000000-0000-0000-0000-000000000001'
from auth.users u
where u.email like '%@6wla.local';

-- Dois workspaces isolados: quem está num não enxerga nada do outro.
insert into public."6wla_workspaces" (id, codigo, nome) values
  ('20000000-0000-0000-0000-000000000001', 'PHD', 'PHD Engenharia'),
  ('20000000-0000-0000-0000-000000000002', 'OUTRA', 'Outra Empresa');

insert into public."6wla_membros_workspace" (workspace_id, user_id, papel) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'admin'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'membro'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'admin');

insert into public."6wla_obras" (id, workspace_id, codigo, nome) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'HRMS', 'Hospital Regional - HRMS'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'CCPS', 'Centro Cirúrgico - CCPS'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'X1', 'Obra da outra empresa');
