-- O DFJÁ cobre apenas o Distrito Federal e o Entorno.
-- Remove a categoria antiga do Centro-Oeste sem apagar artigos: artigos existentes
-- ficam sem categoria e podem ser recategorizados no painel.
delete from public.categories where slug = 'centro-oeste';

