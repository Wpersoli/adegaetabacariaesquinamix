# Migrações legadas arquivadas

Os arquivos desta pasta foram encontrados em `supabase/migrations/`, mas suas versões não constam no histórico de migrações aplicado ao projeto Supabase de produção em 2026-11-25.

Eles foram preservados aqui apenas para rastreabilidade e auditoria. **Não fazem parte da sequência de migrations e não devem ser movidos de volta para `supabase/migrations/` nem executados no projeto ativo.**

Arquivos arquivados:

- `202611160001_esquina_auth.sql`: versão preliminar/duplicada da migração de autenticação.
- `20261117150000_customer_orders.sql`: versão preliminar/duplicada da migração de pedidos.
- `20261117170000_customer_account_details.sql`: versão antiga que adiciona `delivery_address` em `customer_profiles` e substitui a RPC de perfil por uma assinatura de cinco parâmetros. Essa estrutura não existe no banco de produção auditado; o endereço padrão é tratado no metadata do usuário, conforme o fluxo atual.

A sequência ativa deve corresponder exatamente às seis versões listadas em `docs/SUPABASE_SETUP.md` e verificadas por `tools/test_supabase_migrations.sh`.
