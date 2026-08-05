/**
 * Remove o sufixo UUID dos slugs de organizations e games,
 * mantendo apenas o nome em kebab-case. Colisões são resolvidas
 * com sufixo numérico (-2, -3, …).
 *
 * Esta migration NÃO é reversível (os UUIDs originais são perdidos).
 */
exports.up = async (pgm) => {
  // ═══ organizations ═══
  // Remove o sufixo UUID (ex: "indies-brasil-436925a2" → "indies-brasil")
  pgm.sql(`
    UPDATE organizations
    SET slug = regexp_replace(slug, '-[a-f0-9]{8}$', '')
    WHERE slug ~ '-[a-f0-9]{8}$'
  `);

  // Resolve colisões — mantém o primeiro (mais antigo) e renomeia os demais
  pgm.sql(`
    DO $$
    DECLARE
      dup RECORD;
      i INTEGER;
      counter INTEGER;
    BEGIN
      FOR dup IN
        SELECT slug, array_agg(id ORDER BY created_at) as ids
        FROM organizations
        GROUP BY slug
        HAVING count(*) > 1
      LOOP
        counter := 2;
        FOR i IN 2..array_length(dup.ids, 1) LOOP
          WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = dup.slug || '-' || counter) LOOP
            counter := counter + 1;
          END LOOP;
          UPDATE organizations
          SET slug = dup.slug || '-' || counter
          WHERE id = dup.ids[i];
          counter := counter + 1;
        END LOOP;
      END LOOP;
    END;
    $$;
  `);

  // ═══ games ═══
  pgm.sql(`
    UPDATE games
    SET slug = regexp_replace(slug, '-[a-f0-9]{8}$', '')
    WHERE slug ~ '-[a-f0-9]{8}$'
  `);

  pgm.sql(`
    DO $$
    DECLARE
      dup RECORD;
      i INTEGER;
      counter INTEGER;
    BEGIN
      FOR dup IN
        SELECT slug, array_agg(id ORDER BY created_at) as ids
        FROM games
        GROUP BY slug
        HAVING count(*) > 1
      LOOP
        counter := 2;
        FOR i IN 2..array_length(dup.ids, 1) LOOP
          WHILE EXISTS (SELECT 1 FROM games WHERE slug = dup.slug || '-' || counter) LOOP
            counter := counter + 1;
          END LOOP;
          UPDATE games
          SET slug = dup.slug || '-' || counter
          WHERE id = dup.ids[i];
          counter := counter + 1;
        END LOOP;
      END LOOP;
    END;
    $$;
  `);

  // Garante que nenhum slug ficou vazio
  pgm.sql(`
    UPDATE organizations SET slug = id::text WHERE slug = '';
    UPDATE games SET slug = id::text WHERE slug = '';
  `);
};

exports.down = () => {
  // Não reversível — os UUIDs originais foram descartados.
  // Em caso de rollback, restaure a partir de um backup do banco.
};
